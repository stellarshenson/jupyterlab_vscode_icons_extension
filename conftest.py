import pytest

pytest_plugins = ("pytest_jupyter.jupyter_server", )


@pytest.fixture
def jp_server_config(jp_server_config):
    return {
        "ServerApp": {
            "jpserver_extensions": {"jupyterlab_vscode_icons_extension": True},
            # Test against a server which requires authentication on all endpoints
            "allow_unauthenticated_access": False,
        }
    }
