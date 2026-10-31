import { expect, test } from '@jupyterlab/galata';
import { chmod, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const diskPath = (path: string) =>
  join(process.env.JUPYTERLAB_GALATA_ROOT_DIR!, path);
const row = (page: any, name: string) =>
  page.locator('.jp-DirListing-item').filter({
    has: page.getByText(name, { exact: true })
  });

test.use({
  mockSettings: {
    '@stellarshenson/jupyterlab-vscode-icons-extension:plugin': {
      enableExecutableIcons: true
    }
  }
});

test.beforeEach(async ({ tmpPath }) => {
  await mkdir(diskPath(`${tmpPath}/oldpkg`));
  await mkdir(diskPath(`${tmpPath}/newpkg`));
  await writeFile(diskPath(`${tmpPath}/tool`), '#!/bin/sh\n');
  await chmod(diskPath(`${tmpPath}/tool`), 0o755);
  await writeFile(
    diskPath(`${tmpPath}/pyproject.toml`),
    '[project]\nname = "oldpkg"\n'
  );
});

test('executable names retain surrounding spaces', async ({
  page,
  tmpPath
}) => {
  await writeFile(diskPath(`${tmpPath}/ tool`), '// ordinary leading space');
  await writeFile(diskPath(`${tmpPath}/tool `), '// ordinary trailing space');
  await writeFile(diskPath(`${tmpPath}/ spaced-tool `), '#!/bin/sh\n');
  await chmod(diskPath(`${tmpPath}/ spaced-tool `), 0o755);
  await page.filebrowser.openDirectory(tmpPath);
  await expect(page.locator('.vscode-exec-badge')).toHaveCount(2);
  await expect(page.locator('.vscode-exec-badge').first()).toHaveAccessibleName(
    'Executable'
  );
  const executableNames = await page.evaluate(() =>
    [...document.querySelectorAll('.jp-DirListing-item')]
      .filter(item => item.querySelector('.vscode-exec-badge'))
      .map(item => item.querySelector('.jp-DirListing-itemText')!.textContent)
  );
  expect(executableNames.sort()).toEqual([' spaced-tool ', 'tool']);
});

test('a tab retains a filename trailing space when resolving its icon', async ({
  page,
  tmpPath
}) => {
  const path = `${tmpPath}/trailing.js `;
  await writeFile(diskPath(path), '// unmapped trailing-space extension');
  await page.filebrowser.openDirectory(tmpPath);
  await page.evaluate(async path => {
    await (window as any).jupyterapp.commands.execute('docmanager:open', {
      path
    });
  }, path);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.lm-TabBar-tab')].some(
      tab =>
        tab.querySelector('.lm-TabBar-tabLabel')?.textContent === 'trailing.js '
    )
  );
  await page.evaluate(
    () =>
      new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
  const painted = await page.evaluate(() =>
    [...document.querySelectorAll('.lm-TabBar-tab')]
      .find(
        tab =>
          tab.querySelector('.lm-TabBar-tabLabel')?.textContent ===
          'trailing.js '
      )
      ?.querySelector('.lm-TabBar-tabIcon')
      ?.getAttribute('data-vscode-tab-icon')
  );
  expect(painted).toBeNull();
});

test('refresh updates executable and package markers in the same directory', async ({
  page,
  tmpPath
}) => {
  await page.filebrowser.openDirectory(tmpPath);
  await expect(row(page, 'tool').locator('.vscode-exec-badge')).toBeVisible();
  await expect(row(page, 'oldpkg')).toHaveAttribute(
    'data-python-package',
    'true'
  );
  await chmod(diskPath(`${tmpPath}/tool`), 0o644);
  await writeFile(
    diskPath(`${tmpPath}/pyproject.toml`),
    '[project]\nname = "newpkg"\n'
  );
  await page.filebrowser.refresh();
  await expect(row(page, 'tool').locator('.vscode-exec-badge')).toHaveCount(0);
  await expect(row(page, 'oldpkg')).not.toHaveAttribute('data-python-package');
  await expect(row(page, 'newpkg')).toHaveAttribute(
    'data-python-package',
    'true'
  );
});

test('an executable badge never survives a directory change', async ({
  page,
  tmpPath
}) => {
  // The badge reads the executable flag off the listing the browser already
  // fetches, so the stale-response race this test used to pin has no response
  // left to lose: what remains is that a reused row drops the badge when the
  // new directory's listing does not carry it (DEF-ICONS-67).
  await mkdir(diskPath(`${tmpPath}/with-tool`));
  await writeFile(diskPath(`${tmpPath}/with-tool/tool`), '#!/bin/sh\n');
  await chmod(diskPath(`${tmpPath}/with-tool/tool`), 0o755);
  await mkdir(diskPath(`${tmpPath}/plain`));
  await writeFile(diskPath(`${tmpPath}/plain/note.txt`), 'x');
  await page.filebrowser.openDirectory(`${tmpPath}/with-tool`);
  await expect(row(page, 'tool').locator('.vscode-exec-badge')).toBeVisible();
  await page.filebrowser.openDirectory(`${tmpPath}/plain`);
  await expect(row(page, 'note.txt')).toBeVisible();
  await expect(page.locator('.vscode-exec-badge')).toHaveCount(0);
});
