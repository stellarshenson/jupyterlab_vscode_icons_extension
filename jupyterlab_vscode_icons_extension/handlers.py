"""
Server handlers for executable file detection.
"""
import json
import os
from concurrent.futures import ThreadPoolExecutor
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado

# Thread pool for non-blocking file system operations
_executor = ThreadPoolExecutor(max_workers=2)


def _get_executables(full_path: str, root: str) -> list:
    """Get executable files in directory (runs in thread pool)."""
    # Security check - ensure path is within root
    full_path = os.path.realpath(full_path)
    if not full_path.startswith(os.path.realpath(root)):
        return []

    executables = []
    try:
        if os.path.isdir(full_path):
            for entry in os.scandir(full_path):
                if entry.is_file():
                    # Check if file has executable permission
                    if os.access(entry.path, os.X_OK):
                        executables.append(entry.name)
    except (PermissionError, OSError):
        pass  # Silently ignore permission errors

    return executables


class ExecutablesHandler(APIHandler):
    """Handler to detect executable files in a directory."""

    @tornado.web.authenticated
    async def get(self):
        """Get list of executable files in the specified directory.

        Query params:
            path: Directory path relative to server root

        Returns:
            JSON list of executable filenames
        """
        path = self.get_argument('path', '')

        # Get the root directory from contents manager
        root = self.contents_manager.root_dir
        full_path = os.path.join(root, path)

        # Run file system check in thread pool to avoid blocking
        loop = tornado.ioloop.IOLoop.current()
        executables = await loop.run_in_executor(
            _executor, _get_executables, full_path, root
        )

        self.finish(json.dumps(executables))


def setup_handlers(web_app):
    """Register the API handler."""
    host_pattern = '.*$'
    base_url = web_app.settings['base_url']

    route_pattern = url_path_join(base_url, 'vscode-icons', 'executables')
    handlers = [(route_pattern, ExecutablesHandler)]
    web_app.add_handlers(host_pattern, handlers)
