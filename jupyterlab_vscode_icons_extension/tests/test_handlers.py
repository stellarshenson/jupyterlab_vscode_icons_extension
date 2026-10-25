"""Exercise metadata routes against real file contents managers and HTTP auth."""
import json
import logging
import os
import time
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from urllib.parse import urlencode

from jupyter_server.auth.authorizer import Authorizer
from jupyter_server.auth.identity import IdentityProvider, User
from jupyter_server.services.contents.filemanager import (
    AsyncFileContentsManager,
    FileContentsManager,
)
from jupyter_server.services.contents.manager import ContentsManager
from ptyprocess import PtyProcess
from tornado.testing import AsyncHTTPTestCase, gen_test
from tornado.web import Application, HTTPError

from jupyterlab_vscode_icons_extension.handlers import (
    _flag_listed_entries,
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
        self.started = []
        self.terminal_manager = SimpleNamespace(terminals={}, get_terminal=self.started.append)
        app = Application(
            base_url='/test/',
            contents_manager=self.manager,
            server_root_dir=str(self.root),
            terminal_manager=self.terminal_manager,
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

    def request(self, endpoint, path='', authenticate=True):
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

    def listing(self, path=''):
        """Map each listed name to the link flag its entry carries."""
        model = self.manager.get(path, type='directory', content=True)
        return {item['name']: item['symlink'] for item in model['content']}

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

    def terminal_cwd(self, name, authenticate=True):
        headers = {'Authorization': 'Bearer test'} if authenticate else {}
        return self.fetch('/test/vscode-icons/terminal-cwd/' + name, headers=headers, follow_redirects=False)

    def add_terminal(self, name, argv, cwd=None):
        """Start argv on a real pty in the root, or in the given directory."""
        process = PtyProcess.spawn(argv, cwd=str(cwd or self.root))
        self.addCleanup(process.terminate, force=True)
        self.terminal_manager.terminals[name] = SimpleNamespace(ptyproc=process)
        return process

    def test_terminal_cwd_reports_the_foreground_process_directory(self):
        (self.root / 'sub').mkdir()
        shell = self.add_terminal('1', ['bash', '--norc', '--noprofile', '-i'])
        # The subshell is the foreground job in sub; the starting shell stays in the root.
        shell.write(b'(cd sub && exec sleep 30)\n')
        expected = {'cwd': 'sub'}
        deadline = time.monotonic() + 10
        answer = None
        while answer != expected and time.monotonic() < deadline:
            response = self.terminal_cwd('1')
            answer = json.loads(response.body) if response.code == 200 else None
            time.sleep(0.1)
        self.assertEqual(answer, expected)

    def test_terminal_cwd_is_empty_for_a_foreground_process_outside_the_root(self):
        outside = TemporaryDirectory()
        self.addCleanup(outside.cleanup)
        self.add_terminal('1', ['sleep', '30'], cwd=outside.name)
        response = self.terminal_cwd('1')
        self.assertEqual(response.code, 200)
        self.assertEqual(json.loads(response.body), {'cwd': ''})

    def test_terminal_cwd_is_404_for_an_unknown_terminal_and_starts_none(self):
        self.assertEqual(self.terminal_cwd('9').code, 404)
        self.assertEqual(self.started, [])

    def test_terminal_cwd_requires_authentication_and_terminals_read(self):
        self.add_terminal('1', ['sleep', '30'])
        self.assertIn(self.terminal_cwd('1', authenticate=False).code, (302, 403))
        self.authorizer.allowed = False
        self.assertEqual(self.terminal_cwd('1').code, 403)
        self.assertEqual(self.authorizer.calls, [('read', 'terminals')])

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

    def test_listing_entries_carry_the_link_flag_for_files_and_folders(self):
        self.file_and_folder_links()
        listing = self.listing()
        self.assertEqual(
            listing,
            {'file.txt': False, 'folder': False,
             'file-link.txt': True, 'folder-link': True},
        )
        self.assertTrue(all(isinstance(flag, bool) for flag in listing.values()))

    def test_listing_entries_carry_the_executable_flag(self):
        for name in ('script', 'plain', '.hidden-script'):
            entry = self.root / name
            entry.write_text('#!/bin/sh\n')
            entry.chmod(0o755 if name != 'plain' else 0o644)
        outside = self.root.with_name('outside-script')
        outside.write_text('#!/bin/sh\n')
        outside.chmod(0o755)
        (self.root / 'external-script').symlink_to(outside)
        model = self.manager.get('', type='directory', content=True)
        flags = {item['name']: item['executable'] for item in model['content']}
        self.assertEqual(
            flags,
            {'script': True, 'plain': False, 'external-script': False},
        )

    def test_listing_flags_follow_visibility_rules(self):
        self.file_and_folder_links()
        (self.root / '.hidden-link').symlink_to('file.txt')
        self.manager.hide_globs = ['file-link*']
        self.assertEqual(
            self.listing(),
            {'file.txt': False, 'folder': False, 'folder-link': True},
        )
        self.manager.allow_hidden = True
        self.assertEqual(
            self.listing(),
            {'file.txt': False, 'folder': False,
             'folder-link': True, '.hidden-link': True},
        )

    def test_listing_flag_preserves_hidden_directory_refusal_and_visible_alias(self):
        (self.root / '.private').mkdir()
        (self.root / '.private' / 'target').write_text('secret')
        (self.root / '.private' / 'secret-link').symlink_to('target')
        (self.root / 'alias').symlink_to('.private', target_is_directory=True)
        with self.assertRaises(HTTPError) as raised:
            self.manager.get('.private', type='directory', content=True)
        self.assertEqual(raised.exception.status_code, 404)
        self.assertEqual(self.listing('alias'), {'target': False, 'secret-link': True})
        self.manager.allow_hidden = True
        self.assertEqual(self.listing('.private'), {'target': False, 'secret-link': True})

    def test_directory_link_inside_root_lists_and_flags_its_entries(self):
        self.file_and_folder_links()
        (self.root / 'folder' / 'nested-link').symlink_to('../file.txt')
        self.assertEqual(self.listing('folder-link'), {'nested-link': True})

    def test_dangling_link_is_listed_and_flagged(self):
        (self.root / 'dangling-link').symlink_to('missing-target')
        self.assertEqual(self.listing(), {'dangling-link': True})

    def test_listings_that_resolve_outside_root_stay_unflagged(self):
        outside = self.root.with_name('root-sibling')
        outside.mkdir()
        (outside / 'secret').write_text('secret')
        (outside / 'secret-link').symlink_to('secret')
        (self.root / 'outside').symlink_to(outside, target_is_directory=True)
        model = self.manager.get('outside', type='directory', content=True)
        self.assertEqual(
            {item['name']: 'symlink' in item for item in model['content']},
            {'secret': False, 'secret-link': False},
        )

    @gen_test
    async def test_async_contents_manager_listing_is_flagged(self):
        self.file_and_folder_links()
        manager = AsyncFileContentsManager(root_dir=str(self.root))
        _flag_listed_entries(manager)
        model = await manager.get('', type='directory', content=True)
        self.assertEqual(
            {item['name']: (item['symlink'], item['executable'])
             for item in model['content']},
            {'file.txt': (False, False), 'folder': (False, False),
             'file-link.txt': (True, False), 'folder-link': (True, False)},
        )

    def test_flag_listed_entries_skips_managers_without_a_local_filesystem(self):
        remote = ContentsManager()
        _flag_listed_entries(remote)
        self.assertFalse(getattr(remote, '_vscode_listed_flags', False))
        # The root_dir trait requires a directory at construction, so a manager
        # whose root has disappeared since then exercises the isdir guard.
        later_root = self.root / 'later-root'
        later_root.mkdir()
        vanished_root = FileContentsManager(root_dir=str(later_root))
        later_root.rmdir()
        _flag_listed_entries(vanished_root)
        self.assertFalse(getattr(vanished_root, '_vscode_listed_flags', False))

    def test_removed_metadata_routes_are_gone(self):
        for endpoint in ('symlinks', 'executables'):
            with self.subTest(endpoint=endpoint):
                self.assertEqual(self.request(endpoint).code, 404)
