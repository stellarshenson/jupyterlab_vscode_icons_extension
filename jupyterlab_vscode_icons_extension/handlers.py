"""Server handlers for filesystem icon metadata."""
import inspect
import json
import os
import tomllib
from concurrent.futures import ThreadPoolExecutor

from jupyter_server.auth.decorator import authorized
from jupyter_server.base.handlers import APIHandler
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


def _annotate_listing_flags(cm, model):
    """Mark every entry of a directory listing with its link and executable facts.

    The flags ride on the listing the browser already fetches, so no second
    request and no client-side directory knowledge are needed. One scandir
    pass answers for the whole directory: each DirEntry reports whether it is
    a link from the scan itself, and the executable test costs one stat and
    one access call per regular file. A symlink pays the containment test
    too, so a target outside the root is never answered for.
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
    root = cm.root_dir
    if not _within_root(os_path, root):
        return model
    try:
        with os.scandir(os_path) as scanned:
            flags = {}
            for entry in scanned:
                is_link = entry.is_symlink()
                executable = (
                    entry.is_file()
                    and (not is_link or _within_root(entry.path, root))
                    and os.access(entry.path, os.X_OK)
                )
                flags[entry.name] = (is_link, executable)
    except OSError:
        return model
    for entry in entries:
        if isinstance(entry, dict):
            is_link, executable = flags.get(entry.get('name'), (False, False))
            entry.setdefault('symlink', bool(is_link))
            entry.setdefault('executable', bool(executable))
    return model


def _flag_listed_entries(cm, log=None):
    """Wrap the contents manager so its directory listings carry the entry facts.

    The manager is whatever the server was configured with - a
    FileContentsManager, an AsyncFileContentsManager, or one already wrapped
    by another extension - so the guard is by capability rather than by class:
    a root_dir that is a real directory and the path mapping local managers
    provide. The wrapper goes on the instance, which leaves every isinstance
    check and attribute reader on the original object working.
    """
    if getattr(cm, '_vscode_listed_flags', False):
        return
    root = getattr(cm, 'root_dir', None)
    original = getattr(cm, 'get', None)
    if (not isinstance(root, str) or not root or not os.path.isdir(root)
            or not callable(original)
            or not callable(getattr(cm, '_get_os_path', None))):
        # Silent otherwise: the badges simply never appear, and neither the
        # user nor the next debugger can tell that from a directory of links.
        if cm is not None and log is not None:
            log.warning(
                'vscode-icons: %s maps no local root, so its listings carry '
                'no entry flags and link and executable badges stay off',
                type(cm).__name__
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
            # Keep filesystem work off the IOLoop.
            return await tornado.ioloop.IOLoop.current().run_in_executor(
                _executor, _annotate_listing_flags, cm, model
            )
    else:
        def get(*args, **kwargs):
            # A synchronous manager calls this from the IOLoop and its callers
            # expect a model rather than a future, so the scan stays inline.
            return _annotate_listing_flags(cm, original(*args, **kwargs))
    cm.get = get
    cm._vscode_listed_flags = True


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


class TerminalCwdHandler(APIHandler):
    """Report the working directory of a running terminal's foreground process."""

    @tornado.web.authenticated
    @authorized(action='read', resource='terminals')
    def get(self, name):
        """Return the foreground process's current directory, or 404 when it cannot be read."""
        manager = self.settings.get('terminal_manager')
        # .terminals, not get_terminal(): that one starts a terminal for an unknown name.
        terminal = manager.terminals.get(name) if manager else None
        try:
            # The foreground process group, so a nested shell's cd is seen, not
            # only the starting shell's.
            foreground = os.tcgetpgrp(terminal.ptyproc.fd)
            # shortcut: Linux /proc only; macOS and Windows get 404 and the tooltip skips the line.
            cwd = os.readlink(f'/proc/{foreground}/cwd')
        except (AttributeError, OSError):
            raise tornado.web.HTTPError(404, 'No working directory for this terminal')
        self.set_header('Content-Type', 'application/json')
        self.finish(json.dumps({'cwd': cwd}))


def setup_handlers(web_app):
    """Register the API handlers beneath the configured base URL."""
    base_url = web_app.settings['base_url']
    # The listing the file browser already fetches is the cheapest carrier for
    # the per-entry facts, so the flags are installed on the contents manager
    # itself and no metadata route remains.
    _flag_listed_entries(
        web_app.settings.get('contents_manager'), web_app.settings.get('log')
    )
    handlers = [
        (url_path_join(base_url, 'vscode-icons', 'validate-manifest'), ManifestValidationHandler),
        (url_path_join(base_url, 'vscode-icons', 'terminal-cwd', '([^/]+)'), TerminalCwdHandler),
    ]
    web_app.add_handlers('.*$', handlers)
