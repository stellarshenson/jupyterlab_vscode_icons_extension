"""Exercise metadata routes against real file contents managers and HTTP auth."""
import json
import logging
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from urllib.parse import urlencode

from jupyter_server.auth.authorizer import Authorizer
from jupyter_server.auth.identity import IdentityProvider, User
from jupyter_server.services.contents.filemanager import (
    AsyncFileContentsManager,
    FileContentsManager,
)
from jupyter_server.services.contents.manager import ContentsManager
from tornado.testing import AsyncHTTPTestCase
from tornado.web import Application

from jupyterlab_vscode_icons_extension.handlers import (
    _get_executables,
    _get_symlinks,
    setup_handlers,
)


class HeaderIdentity(IdentityProvider):
    def get_user(self, handler):
        return User('tester') if handler.request.headers.get('Authorization') == 'Bearer test' else None


class RecordingAuthorizer(Authorizer):
    allowed = True

    def __init__(self):
        super().__init__()
        self.calls = []

    async def is_authorized(self, handler, user, action, resource):
        self.calls.append((action, resource))
        return self.allowed


class MetadataHandlerTests(AsyncHTTPTestCase):
    def get_app(self):
        self.temporary = TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / 'root'
        self.root.mkdir()
        self.manager = FileContentsManager(root_dir=str(self.root))
        self.authorizer = RecordingAuthorizer()
        app = Application(
            base_url='/test/',
            contents_manager=self.manager,
            identity_provider=HeaderIdentity(),
            authorizer=self.authorizer,
            allow_unauthenticated_access=True,
            allow_remote_access=True,
            cookie_secret='test-only',
            # Exercise route auth with the test identity provider; browsers use
            # Jupyter's normal token/XSRF protection, which this fixture omits.
            disable_check_xsrf=True,
            login_url='/login',
            log=logging.getLogger(__name__),
        )
        setup_handlers(app)
        return app

    def request(self, endpoint='symlinks', path='', authenticate=True):
        headers = {'Authorization': 'Bearer test'} if authenticate else {}
        return self.fetch(
            '/test/vscode-icons/' + endpoint + '?' + urlencode({'path': path}),
            headers=headers,
            follow_redirects=False,
        )

    def file_and_folder_links(self):
        (self.root / 'file.txt').write_text('ordinary file')
        (self.root / 'folder').mkdir()
        (self.root / 'file-link.txt').symlink_to('file.txt')
        (self.root / 'folder-link').symlink_to('folder', target_is_directory=True)

    def validate_manifest(self, payload, authenticate=True, raw=False):
        headers = {'Content-Type': 'application/json'}
        if authenticate:
            headers['Authorization'] = 'Bearer test'
        return self.fetch(
            '/test/vscode-icons/validate-manifest',
            method='POST',
            body=payload if raw else json.dumps(payload),
            headers=headers,
            follow_redirects=False,
        )

    def test_manifest_validation_requires_authentication_and_contents_read(self):
        payload = {'kind': 'toml', 'source': '[project]\nname = "sample"\n'}
        self.assertIn(self.validate_manifest(payload, authenticate=False).code, (302, 403))
        self.authorizer.allowed = False
        self.assertEqual(self.validate_manifest(payload).code, 403)
        self.assertEqual(self.authorizer.calls, [('read', 'contents')])

    def test_manifest_validation_checks_the_entire_toml_document(self):
        for source, valid in (
            ('[project]\nname = "sample"\n', True),
            ('[tool.poetry]\nname = "poetry-name"\n', True),
            ('[project]\nname = "sample"\ninvalid = [\n', False),
            ('[project]\nname = "sample"\nname = "duplicate"\n', False),
        ):
            with self.subTest(source=source):
                response = self.validate_manifest({'kind': 'toml', 'source': source})
                self.assertEqual(response.code, 200)
                self.assertEqual(json.loads(response.body), {'valid': valid})
                self.assertTrue(response.headers['Content-Type'].startswith('application/json'))

    def test_manifest_validation_uses_python_compiler_rules(self):
        for source, valid in (
            ('from setuptools import setup\nsetup(name="sample")\n', True),
            ('setup(name="sample",\n', False),
            ('setup(name="sample")\nreturn\n', False),
            ('setup(name="sample")\nbreak\n', False),
            ('setup(name="sample", name="duplicate")\n', False),
            ('setup(name="sample")\ndef f(arg, arg): pass\n', False),
        ):
            with self.subTest(source=source):
                response = self.validate_manifest({'kind': 'python', 'source': source})
                self.assertEqual(response.code, 200)
                self.assertEqual(json.loads(response.body), {'valid': valid})

    def test_manifest_validation_never_executes_python(self):
        marker = self.root / 'must-not-exist'
        source = f'from pathlib import Path\nPath({str(marker)!r}).write_text("executed")\nraise RuntimeError("not execution")\n'
        response = self.validate_manifest({'kind': 'python', 'source': source})
        self.assertEqual(response.code, 200)
        self.assertEqual(json.loads(response.body), {'valid': True})
        self.assertFalse(marker.exists())

    def test_manifest_validation_accepts_source_from_remote_contents_providers(self):
        self._app.settings['contents_manager'] = ContentsManager()
        response = self.validate_manifest({'kind': 'toml', 'source': '[project]\nname="remote"\n'})
        self.assertEqual(response.code, 200)
        self.assertEqual(json.loads(response.body), {'valid': True})

    def test_manifest_validation_rejects_invalid_payloads(self):
        for payload in (None, [], {}, {'kind': 'json', 'source': '{}'},
                        {'kind': 'python', 'source': None}, {'kind': 'toml', 'source': 1},
                        {'kind': ['toml'], 'source': ''}):
            with self.subTest(payload=payload):
                self.assertEqual(self.validate_manifest(payload).code, 400)
        self.assertEqual(self.validate_manifest('{', raw=True).code, 400)

    def test_returns_only_symlink_names_for_files_and_folders(self):
        self.file_and_folder_links()
        response = self.request()
        self.assertEqual(response.code, 200)
        self.assertEqual(set(json.loads(response.body)), {'file-link.txt', 'folder-link'})
        self.assertEqual(self.authorizer.calls, [('read', 'contents')])
        self.assertTrue(response.headers['Content-Type'].startswith('application/json'))

    def test_authentication_and_contents_read_authorization_required(self):
        self.file_and_folder_links()
        for endpoint in ('symlinks', 'executables'):
            with self.subTest(endpoint=endpoint):
                response = self.request(endpoint, authenticate=False)
                self.assertIn(response.code, (302, 403))
                self.authorizer.allowed = False
                self.assertEqual(self.request(endpoint).code, 403)
        self.assertTrue(all(call == ('read', 'contents') for call in self.authorizer.calls))

    def test_hidden_entries_and_contents_manager_exclusions_are_respected(self):
        self.file_and_folder_links()
        (self.root / '.hidden-link').symlink_to('file.txt')
        self.manager.hide_globs = ['file-link*']
        self.assertEqual(json.loads(self.request().body), ['folder-link'])
        self.manager.allow_hidden = True
        self.assertEqual(set(json.loads(self.request().body)), {'folder-link', '.hidden-link'})

    def test_hidden_directory_and_visible_alias_to_hidden_directory_are_refused(self):
        (self.root / '.private').mkdir()
        (self.root / '.private' / 'target').write_text('secret')
        (self.root / '.private' / 'secret-link').symlink_to('target')
        (self.root / 'alias').symlink_to('.private', target_is_directory=True)
        for path in ('.private', 'alias'):
            with self.subTest(path=path):
                self.assertEqual(self.request(path=path).code, 404)
        self.manager.allow_hidden = True
        self.assertEqual(json.loads(self.request(path='alias').body), ['secret-link'])

    def test_directory_symlink_inside_root_can_be_browsed(self):
        self.file_and_folder_links()
        (self.root / 'folder' / 'nested-link').symlink_to('../file.txt')
        self.assertEqual(json.loads(self.request(path='folder-link').body), ['nested-link'])

    def test_traversal_sibling_prefix_and_external_directory_symlink_are_refused(self):
        outside = self.root.with_name('root-sibling')
        outside.mkdir()
        (outside / 'secret').write_text('secret')
        (outside / 'secret-link').symlink_to('secret')
        (self.root / 'outside').symlink_to(outside, target_is_directory=True)
        for path in ('../root-sibling', 'outside', 'outside/secret', 'bad\x00path'):
            with self.subTest(path=path):
                self.assertEqual(self.request(path=path).code, 404)

    def test_missing_directory_and_file_path_use_contents_errors(self):
        (self.root / 'file').write_text('not a directory')
        self.assertEqual(self.request(path='missing').code, 404)
        self.assertEqual(self.request(path='file').code, 400)

    def test_dangling_symlink_is_reported_when_contents_manager_lists_it(self):
        (self.root / 'dangling-link').symlink_to('missing-target')
        response = self.request()
        self.assertEqual(response.code, 200)
        self.assertEqual(json.loads(response.body), ['dangling-link'])

    def test_async_contents_manager_is_supported(self):
        self.file_and_folder_links()
        self._app.settings['contents_manager'] = AsyncFileContentsManager(root_dir=str(self.root))
        self.assertEqual(set(json.loads(self.request().body)), {'file-link.txt', 'folder-link'})

    def test_remote_contents_manager_returns_empty_without_local_filesystem_assumption(self):
        self._app.settings['contents_manager'] = ContentsManager()
        for endpoint in ('symlinks', 'executables'):
            response = self.request(endpoint)
            self.assertEqual(response.code, 200)
            self.assertEqual(json.loads(response.body), [])

    def test_executables_follow_visibility_and_reject_external_targets(self):
        for name in ('script', '.private-script', 'omit-script'):
            entry = self.root / name
            entry.write_text('#!/bin/sh\n')
            entry.chmod(0o755)
        outside = self.root.with_name('outside-script')
        outside.write_text('#!/bin/sh\n')
        outside.chmod(0o755)
        (self.root / 'external-script').symlink_to(outside)
        self.manager.hide_globs = ['omit-*']
        self.assertEqual(json.loads(self.request('executables').body), ['script'])


class ScannerTests(unittest.TestCase):
    def test_common_prefix_does_not_grant_access_to_sibling(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary) / 'root'
            root.mkdir()
            sibling = Path(temporary) / 'root-private'
            sibling.mkdir()
            script = sibling / 'secret'
            script.write_text('#!/bin/sh\n')
            script.chmod(0o755)
            (sibling / 'secret-link').symlink_to('secret')
            self.assertEqual(_get_executables(str(sibling), str(root)), [])
            self.assertEqual(_get_symlinks(str(sibling), str(root), {'secret-link'}), [])

    def test_disappeared_directory_returns_empty(self):
        with TemporaryDirectory() as temporary:
            missing = os.path.join(temporary, 'missing')
            self.assertEqual(_get_executables(missing, temporary), [])
            self.assertEqual(_get_symlinks(missing, temporary, {'anything'}), [])
