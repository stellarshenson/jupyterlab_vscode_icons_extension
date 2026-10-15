"""Server handlers for filesystem icon metadata."""
import json
import os
import tomllib
from concurrent.futures import ThreadPoolExecutor
from functools import partial

from jupyter_core.utils import ensure_async
from jupyter_server.auth.decorator import authorized
from jupyter_server.base.handlers import APIHandler
from jupyter_server.services.contents.filemanager import FileContentsManager
from jupyter_server.utils import url_path_join
import tornado

# Thread pool for non-blocking file system operations.
_executor = ThreadPoolExecutor(max_workers=2)


def _within_root(path: str, root: str) -> bool:
    """Compare resolved path components, rather than a shared string prefix."""
    try:
        root = os.path.realpath(root)
        return os.path.commonpath([os.path.realpath(path), root]) == root
    except (OSError, ValueError):
        return False


def _get_executables(full_path: str, root: str, names=None) -> list:
    """Get visible executable files in a directory (runs in the thread pool)."""
    if not _within_root(full_path, root):
        return []

    executables = []
    try:
        with os.scandir(full_path) as entries:
            for entry in entries:
                if names is not None and entry.name not in names:
                    continue
                if (_within_root(entry.path, root) and entry.is_file()
                        and os.access(entry.path, os.X_OK)):
                    executables.append(entry.name)
    except OSError:
        pass  # A directory may disappear or lose permissions after it was listed.
    return executables


def _get_symlinks(full_path: str, root: str, names) -> list:
    """Return link names from the contents manager's visible directory entries."""
    if not _within_root(full_path, root):
        return []
    try:
        with os.scandir(full_path) as entries:
            return [entry.name for entry in entries
                    if entry.name in names and entry.is_symlink()]
    except OSError:
        return []


class _FilesystemMetadataHandler(APIHandler):
    """Restrict metadata to directories the contents manager actually exposes."""

    async def _directory(self, path):
        cm = self.contents_manager
        # A root_dir attribute alone does not imply that a remote contents
        # manager maps API paths to local filesystem paths.
        if not isinstance(cm, FileContentsManager):
            return None
        full_path = cm._get_os_path(path)
        root = cm.root_dir
        if not _within_root(full_path, root):
            raise tornado.web.HTTPError(404, 'Directory does not exist')
        resolved_path = os.path.relpath(os.path.realpath(full_path), os.path.realpath(root))
        resolved_path = '' if resolved_path == '.' else resolved_path.replace(os.sep, '/')
        if not cm.allow_hidden:
            # Check both names: an innocuous link must not expose the contents
            # of a hidden target directory through this auxiliary endpoint.
            if (await ensure_async(cm.is_hidden(path))
                    or await ensure_async(cm.is_hidden(resolved_path))):
                raise tornado.web.HTTPError(404, 'Directory does not exist')
        # A synchronous contents manager can stat every entry; keep that work
        # off the IOLoop too. Async managers return a coroutine to await here.
        model = await tornado.ioloop.IOLoop.current().run_in_executor(
            _executor, partial(cm.get, path, type='directory', content=True)
        )
        model = await ensure_async(model)
        names = {item['name'] for item in model.get('content', [])}
        return full_path, root, names

    async def _finish_metadata(self, scanner):
        directory = await self._directory(self.get_argument('path', ''))
        result = []
        if directory is not None:
            result = await tornado.ioloop.IOLoop.current().run_in_executor(
                _executor, scanner, *directory
            )
        self.set_header('Content-Type', 'application/json')
        self.finish(json.dumps(result))


class ExecutablesHandler(_FilesystemMetadataHandler):
    """Detect executable files visible in a directory."""

    @tornado.web.authenticated
    @authorized(action='read', resource='contents')
    async def get(self):
        """Return executable filenames; path is relative to the contents root."""
        await self._finish_metadata(_get_executables)


class SymlinksHandler(_FilesystemMetadataHandler):
    """Detect symbolic links without exposing their target paths."""

    @tornado.web.authenticated
    @authorized(action='read', resource='contents')
    async def get(self):
        """Return symlink entry names; path is relative to the contents root."""
        await self._finish_metadata(_get_symlinks)


def _valid_manifest(source: str, kind: str) -> bool:
    """Validate a whole manifest without executing setup.py (in the executor)."""
    try:
        if kind == 'toml':
            tomllib.loads(source)
        else:
            compile(source, '<setup.py>', 'exec', dont_inherit=True)
    except (tomllib.TOMLDecodeError, SyntaxError, ValueError):
        return False
    return True


class ManifestValidationHandler(APIHandler):
    """Check source from any contents provider before extracting package names."""

    @tornado.web.authenticated
    @authorized(action='read', resource='contents')
    async def post(self):
        """Return syntax validity; do not read paths or execute supplied source."""
        body = self.get_json_body()
        if (not isinstance(body, dict)
                or body.get('kind') not in ('toml', 'python')
                or not isinstance(body.get('source'), str)):
            raise tornado.web.HTTPError(400, 'Expected kind and source string')
        valid = await tornado.ioloop.IOLoop.current().run_in_executor(
            _executor, _valid_manifest, body['source'], body['kind']
        )
        self.set_header('Content-Type', 'application/json')
        self.finish(json.dumps({'valid': valid}))


def setup_handlers(web_app):
    """Register the API handlers beneath the configured base URL."""
    base_url = web_app.settings['base_url']
    handlers = [
        (url_path_join(base_url, 'vscode-icons', 'executables'), ExecutablesHandler),
        (url_path_join(base_url, 'vscode-icons', 'symlinks'), SymlinksHandler),
        (url_path_join(base_url, 'vscode-icons', 'validate-manifest'), ManifestValidationHandler),
    ]
    web_app.add_handlers('.*$', handlers)
