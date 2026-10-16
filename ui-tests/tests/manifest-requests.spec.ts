import { expect, test } from '@jupyterlab/galata';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

// Python-package detection reads a manifest only when the directory listing
// names it, and passes that overlap on one listing share one fetch
// (DEF-ICONS-69). The name filter does not hide a manifest from the check
// (DEF-ICONS-64).

const diskPath = (path: string) =>
  join(process.env.JUPYTERLAB_GALATA_ROOT_DIR!, path);
const row = (page: any, name: string) =>
  page.locator('.jp-DirListing-item').filter({
    has: page.getByText(name, { exact: true })
  });
const MANIFEST_REQUEST =
  /\/api\/contents\/.*\/(pyproject\.toml|setup\.py)(\?|$)/;

const recordManifestRequests = (page: any): string[] => {
  const seen: string[] = [];
  page.on('request', (request: any) => {
    const match = MANIFEST_REQUEST.exec(request.url());
    if (match) {
      seen.push(match[1]);
    }
  });
  return seen;
};

// Long enough for the manifest round trip and the passes after it
const settle = (page: any) => page.waitForTimeout(500);

test('a folder without a manifest sends no manifest request', async ({
  page,
  tmpPath
}) => {
  await mkdir(diskPath(`${tmpPath}/plain`));
  await writeFile(diskPath(`${tmpPath}/plain/note.txt`), 'x');
  const seen = recordManifestRequests(page);
  await page.filebrowser.openDirectory(`${tmpPath}/plain`);
  await expect(row(page, 'note.txt')).toBeVisible();
  await settle(page);
  await page.filebrowser.refresh();
  await settle(page);
  await page.filebrowser.refresh();
  await settle(page);
  expect(seen).toEqual([]);
});

test('a name filter hiding pyproject.toml keeps the package glyph', async ({
  page,
  tmpPath
}) => {
  await mkdir(diskPath(`${tmpPath}/filteredpkg`));
  await writeFile(
    diskPath(`${tmpPath}/pyproject.toml`),
    '[project]\nname = "filteredpkg"\n'
  );
  await page.filebrowser.openDirectory(tmpPath);
  await page.evaluate(async () => {
    const app = (window as any).jupyterapp;
    const browser = [...app.shell.widgets('left')].find(
      (widget: any) => widget.id === 'filebrowser'
    );
    browser.model.setFilter((item: any) =>
      item.name === 'pyproject.toml' ? null : {}
    );
    await browser.model.refresh();
  });
  await expect(row(page, 'pyproject.toml')).toHaveCount(0);
  await expect(row(page, 'filteredpkg')).toHaveAttribute(
    'data-python-package',
    'true'
  );
});

test('a burst of listing changes sends one request per listed manifest', async ({
  page,
  tmpPath
}) => {
  await mkdir(diskPath(`${tmpPath}/oldpkg`));
  await mkdir(diskPath(`${tmpPath}/newpkg`));
  await writeFile(
    diskPath(`${tmpPath}/pyproject.toml`),
    '[project]\nname = "oldpkg"\n'
  );
  await page.filebrowser.openDirectory(tmpPath);
  await expect(row(page, 'oldpkg')).toHaveAttribute(
    'data-python-package',
    'true'
  );
  await settle(page);
  // A slow manifest response keeps the first fetch in flight while the other
  // passes over the same listing start: one refresh emits `refreshed` three
  // times, and the observer schedules a pass of its own.
  await page.route(MANIFEST_REQUEST, async (route: any) => {
    await new Promise(resolve => setTimeout(resolve, 400));
    await route.continue();
  });
  const seen = recordManifestRequests(page);
  for (const name of ['a.txt', 'b.txt', 'c.txt']) {
    await writeFile(diskPath(`${tmpPath}/${name}`), 'x');
  }
  await writeFile(
    diskPath(`${tmpPath}/pyproject.toml`),
    '[project]\nname = "newpkg"\n'
  );
  await page.filebrowser.refresh();
  await expect(row(page, 'newpkg')).toHaveAttribute(
    'data-python-package',
    'true'
  );
  await settle(page);
  expect(seen).toEqual(['pyproject.toml']);
  await expect(row(page, 'oldpkg')).not.toHaveAttribute('data-python-package');
});

test('a refresh that finds the manifest unchanged sends no request', async ({
  page,
  tmpPath
}) => {
  await mkdir(diskPath(`${tmpPath}/steadypkg`));
  await writeFile(
    diskPath(`${tmpPath}/pyproject.toml`),
    '[project]\nname = "steadypkg"\n'
  );
  await page.filebrowser.openDirectory(tmpPath);
  await expect(row(page, 'steadypkg')).toHaveAttribute(
    'data-python-package',
    'true'
  );
  await settle(page);
  const seen = recordManifestRequests(page);
  await writeFile(diskPath(`${tmpPath}/note.txt`), 'x');
  await page.filebrowser.refresh();
  await expect(row(page, 'note.txt')).toBeVisible();
  await settle(page);
  await page.filebrowser.refresh();
  await settle(page);
  expect(seen).toEqual([]);
  await expect(row(page, 'steadypkg')).toHaveAttribute(
    'data-python-package',
    'true'
  );
});
