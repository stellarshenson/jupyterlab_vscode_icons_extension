/**
 * Configuration for Playwright using default from @jupyterlab/galata
 */
const baseConfig = require('@jupyterlab/galata/lib/playwright-config');
const { existsSync, mkdirSync, mkdtempSync, symlinkSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

// Galata and the test workers share a temporary filesystem for real links.
process.env.JUPYTERLAB_GALATA_ROOT_DIR ||= mkdtempSync(
  join(tmpdir(), 'vscode-icons-galata-')
);

// The test server imports the installed package, so the /labextensions route
// serves whatever labextension the environment has, not the tree under test:
// a run after editing src/ without installing passes on the previous wheel
// (DEF-TEST-68). Point JUPYTER_PATH at the repo build so the suite exercises
// the working tree; an explicit JUPYTER_PATH still wins.
const repoRoot = join(__dirname, '..');
const repoLabextension = join(
  repoRoot,
  'jupyterlab_vscode_icons_extension',
  'labextension'
);
if (!process.env.JUPYTER_PATH && existsSync(repoLabextension)) {
  const shim = mkdtempSync(join(tmpdir(), 'vscode-icons-jpath-'));
  const links = join(shim, 'labextensions');
  mkdirSync(links, { recursive: true });
  symlinkSync(
    repoLabextension,
    join(links, 'jupyterlab_vscode_icons_extension')
  );
  process.env.JUPYTER_PATH = shim;
}

// The server half needs the same treatment: the test server imports the
// installed python package, so without this it runs the installed handlers,
// which may predate the tree (DEF-TEST-68).
if (
  !process.env.PYTHONPATH &&
  existsSync(join(repoRoot, 'jupyterlab_vscode_icons_extension', 'handlers.py'))
) {
  process.env.PYTHONPATH = repoRoot;
}

// `jupyterlab.galata.configure_jupyter_server` pins `c.ServerApp.port = 8888`
// and sets `port_retries = 0`, so the test server dies rather than move when
// that port is taken - a developer running their own lab there cannot start the
// suite at all, and the failure reads as "Process from config.webServer was not
// able to start". One variable drives both ends. Galata resolves its base URL
// from `use.baseURL` first, and its own config sets none, so this file must.
const PORT = process.env.JUPYTER_TEST_PORT || '8888';
const BASE_URL = `http://localhost:${PORT}`;

module.exports = {
  ...baseConfig,
  // The specs wait up to 30 s for a debounced paint, and the first test of a
  // run also pays for the lab's own startup. One run on a loaded machine timed
  // out in 'every row keeps its own glyph across navigation' while passing on
  // its own, so the per-test budget is set above the sum rather than left at
  // the default.
  timeout: 90 * 1000,
  // One JupyterLab server serves the whole suite, and playwright defaults to a
  // worker per core: eight browsers driving one server made
  // 'every row keeps its own glyph across navigation' time out in three full
  // runs while passing every time on its own. Two workers keep the run near a
  // minute and the server unsaturated.
  workers: 2,
  use: { ...baseConfig.use, baseURL: BASE_URL },
  webServer: {
    command: 'jlpm start',
    url: `${BASE_URL}/lab`,
    timeout: 120 * 1000,
    reuseExistingServer: false
  }
};
