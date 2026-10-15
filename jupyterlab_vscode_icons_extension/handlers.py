"""Server handlers for filesystem icon metadata."""
import inspect
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


def _annotate_symlink_flags(cm, model):
    """Mark every entry of a directory listing with whether it is a link.

    The flag rides on the listing the browser already fetches, so no second
    request and no client-side directory knowledge are needed. One scandir
    pass answers for the whole directory: each DirEntry reports whether it is
    a link from the scan itself, so no entry costs an extra lstat.
    """
    if not isinstance(model, dict) or model.get('type') != 'directory':
        return model
    entries = model.get('content')
    if not isinstance(entries, list):
        return model
    try:
        os_path = cm._get_os_path(model.get('path') or '')
    except (OSError, ValueError, tornado.web.HTTPError):
        # _get_os_path refuses with HTTPError, and a listing the manager has
        # already served must not turn into an error because of the annotation.
        return model
    if not _within_root(os_path, cm.root_dir):
        return model
    try:
        with os.scandir(os_path) as scanned:
            links = {entry.name: entry.is_symlink() for entry in scanned}
    except OSError:
        return model
    for entry in entries:
        if isinstance(entry, dict):
            entry.setdefault('symlink', bool(links.get(entry.get('name'))))
    return model


def _flag_listed_links(cm, log=None):
    """Wrap the contents manager so its directory listings carry the link fact.

    The manager is whatever the server was configured with - a
    FileContentsManager, an AsyncFileContentsManager, or one already wrapped
    by another extension - so the guard is by capability rather than by class:
    a root_dir that is a real directory and the path mapping local managers
    provide. The wrapper goes on the instance, which leaves every isinstance
    check and attribute reader on the original object working.
    """
    if getattr(cm, '_vscode_link_flags', False):
        return
    root = getattr(cm, 'root_dir', None)
    original = getattr(cm, 'get', None)
    if (not isinstance(root, str) or not root or not os.path.isdir(root)
            or not callable(original)
            or not callable(getattr(cm, '_get_os_path', None))):
        # Silent otherwise: the badge simply never appears, and neither the
        # user nor the next debugger can tell that from a directory of links.
        if cm is not None and log is not None:
            log.warning(
                'vscode-icons: %s maps no local root, so its listings carry '
                'no symlink flag and link badges stay off', type(cm).__name__
            )
        return
    if inspect.iscoroutinefunction(original):
        async def get(*args, **kwargs):
            model = await original(*args, **kwargs)
            # _dir_model gets every entry of a listing through this same call,
            # and a subdirectory entry is itself a directory model, so the test
            # that rules out the scan runs before the hop: a file costs nothing,
            # a subdirectory costs nothing, and one listing costs one hop.
            if (not isinstance(model, dict)
                    or model.get('type') != 'directory'
                    or not isinstance(model.get('content'), list)):
                return model
            # As in _directory: keep filesystem work off the IOLoop.
            return await tornado.ioloop.IOLoop.current().run_in_executor(
                _executor, _annotate_symlink_flags, cm, model
            )
    else:
        def get(*args, **kwargs):
            # A synchronous manager calls this from the IOLoop and its callers
            # expect a model rather than a future, so the scan stays inline.
            return _annotate_symlink_flags(cm, original(*args, **kwargs))
    cm.get = get
    cm._vscode_link_flags = True


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


def _valid_manifest(source: str, kind: str) -> bool:
    """Validate a whole manifest without executing setup.py (in the executor)."""
    try:
        if kind == 'toml':
            tomllib.loads(source)
        else:
            compile(source, '<setup.py>', 'exec', dont_inherit=True)
    except (tomllib.TOMLDecodeError, SyntaxError, ValueError):
        return False
    except RecursionError:
        # Deeply nested input exhausts the parser's stack rather than raising a
        # decode error; the caller falls back to its own extraction on a failed
        # call, so an unparsable source has to be answered, not raised.
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
    # The listing the file browser already fetches is the cheapest carrier for
    # the link fact, so the flag is installed on the contents manager itself.
    _flag_listed_links(
        web_app.settings.get('contents_manager'), web_app.settings.get('log')
    )
    handlers = [
        (url_path_join(base_url, 'vscode-icons', 'executables'), ExecutablesHandler),
        (url_path_join(base_url, 'vscode-icons', 'validate-manifest'), ManifestValidationHandler),
    ]
    web_app.add_handlers('.*$', handlers)
