"""Server configuration for integration tests.

!! Never use this configuration in production because it
opens the server to the world and provide access to JupyterLab
JavaScript objects through the global window variable.
"""
import os
from tempfile import mkdtemp

from jupyterlab.galata import configure_jupyter_server

configure_jupyter_server(c)
c.ServerApp.jpserver_extensions.update({"jupyterlab_vscode_icons_extension": True})

# `or`, not a get() default: an exported-but-empty JUPYTER_TEST_PORT would raise
# ValueError here while Playwright waited happily on 8888.
c.ServerApp.port = int(os.environ.get("JUPYTER_TEST_PORT") or "8888")

# configure_jupyter_server moves the workspaces folder and the server root to
# temporary folders but not the user settings folder. Without this the test
# server reads and writes the developer's own ~/.jupyter/lab/user-settings, so a
# settings write during a test - a theme switch, a font size - lands in their
# lab and applies on its next page load.
c.LabApp.user_settings_dir = mkdtemp(prefix="galata-settings-")

# The dotfile specs need the server to list and create dot-named files, which
# jupyter_server refuses by default. A workstation config that enables it - this
# image's /opt/conda/etc/jupyter/jupyter_lab_config.py does - made them pass
# locally while every CI run failed them (DEF-TEST-73).
c.ContentsManager.allow_hidden = True

# Galata's waitForApplication waits for the splash to detach and then for the
# Launcher tab to be active. An extension that opens its own tab at startup - the
# GalaxaHub message of the day on this workstation image - keeps the Launcher
# inactive, so every test times out inside page.goto with the same signature as a
# galata/lab version mismatch. traitlets ignores this line where the extension is
# not installed, as in CI.
c.GalaxaHubMotd.open_on_start = False

# Uncomment to set server log level to debug level
# c.ServerApp.log_level = "DEBUG"
