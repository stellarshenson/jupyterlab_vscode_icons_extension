/**
 * Configuration for Playwright using default from @jupyterlab/galata
 */
const baseConfig = require('@jupyterlab/galata/lib/playwright-config');
const { existsSync, mkdirSync, mkdtempSync, symlinkSync } = require('fs');
const { tmpdir } = require('os');
const { dirname, join } = require('path');

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
  const links = join(shim, 'labextensions', '@stellarshenson');
  mkdirSync(links, { recursive: true });
  symlinkSync(
    repoLabextension,
    join(links, 'jupyterlab-vscode-icons-extension')
  );
  process.env.JUPYTER_PATH = shim;
}

// The server half needs the same treatment: the test server imports the
// installed python package, so without this it runs the installed handlers,
// which may predate the tree (DEF-TEST-68). It applies only where the repo
// build exists, as JUPYTER_PATH does above, so a checkout without a build -
// the CI Integration tests job - imports the installed wheel for both halves
// (DEF-TEST-74).
if (!process.env.PYTHONPATH && existsSync(repoLabextension)) {
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
  // Galata deletes each test's folder in the server root when the test ends.
  // jupyter_server 2.21 answers a root listing with 404 when an entry is
  // deleted while it is listed, and the lab shows 'Directory not found' over
  // the other worker's page (DEF-TEST-98). serverFiles 'on' keeps the folders;
  // each run makes a new root above, so they never reach the next run. A preset
  // JUPYTERLAB_GALATA_ROOT_DIR or a test retry still deletes folders mid-run.
  // shortcut: Galata's openDirectory matches a folder name by prefix, so a test
  // whose folder name starts another kept test's folder name fails; rename it.
  use: { ...baseConfig.use, baseURL: BASE_URL, serverFiles: 'on' },
  webServer: {
    command: 'jlpm start',
    url: `${BASE_URL}/lab`,
    timeout: 120 * 1000,
    reuseExistingServer: false,
    // jupyter_server stores a root under HOME as ~/..., as on a real lab
    // (DEF-TABS-93). The server then reads no Jupyter config or Python user
    // packages from the developer's home.
    env: { HOME: dirname(process.env.JUPYTERLAB_GALATA_ROOT_DIR) }
  }
};
