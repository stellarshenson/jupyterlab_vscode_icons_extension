import { expect, test } from '@jupyterlab/galata';
import { mkdir, symlink, unlink, writeFile } from 'fs/promises';
import { join } from 'path';

const diskPath = (path: string) =>
  join(process.env.JUPYTERLAB_GALATA_ROOT_DIR!, path);
const row = (page: any, name: string) =>
  page.locator('.jp-DirListing-item').filter({
    has: page.locator('.jp-DirListing-itemText', { hasText: name })
  });

test.beforeEach(async ({ tmpPath }) => {
  await mkdir(diskPath(`${tmpPath}/target-folder`), { recursive: true });
  await writeFile(diskPath(`${tmpPath}/target.js`), '// link target');
  await symlink('target.js', diskPath(`${tmpPath}/linked.js`));
  await symlink('target-folder', diskPath(`${tmpPath}/linked-folder`), 'dir');
});

test('surrounding spaces remain part of a link name', async ({
  page,
  tmpPath
}) => {
  await writeFile(
    diskPath(`${tmpPath}/ linked.js`),
    '// ordinary leading space'
  );
  await writeFile(
    diskPath(`${tmpPath}/linked.js `),
    '// ordinary trailing space'
  );
  await symlink('target.js', diskPath(`${tmpPath}/ spaced-link.js `));
  await page.filebrowser.openDirectory(tmpPath);
  await expect(page.locator('.vscode-symlink-badge')).toHaveCount(3);
  const badges = await page.evaluate(() =>
    [...document.querySelectorAll('.jp-DirListing-item')]
      .filter(item => item.querySelector('.vscode-symlink-badge'))
      .map(item => item.querySelector('.jp-DirListing-itemText')!.textContent)
  );
  expect(badges.sort()).toEqual(
    [' spaced-link.js ', 'linked-folder', 'linked.js'].sort()
  );
});

test('file and folder links retain their icons with visible badges', async ({
  page,
  tmpPath
}) => {
  await page.filebrowser.openDirectory(tmpPath);
  for (const [link, target] of [
    ['linked.js', 'target.js'],
    ['linked-folder', 'target-folder']
  ]) {
    const linked = row(page, link);
    const regular = row(page, target);
    await expect(linked.locator('.vscode-symlink-badge')).toBeVisible();
    await expect(linked.locator('[aria-label="Symbolic link"]')).toHaveCount(1);
    expect(await linked.getAttribute('data-file-type')).toBe(
      await regular.getAttribute('data-file-type')
    );
    const baseIconVisible = await linked.evaluate((item: HTMLElement) => {
      const host = item.querySelector('.jp-DirListing-itemIcon')!;
      const svg = host.querySelector('svg');
      return (
        (!!svg && getComputedStyle(svg).display !== 'none') ||
        getComputedStyle(host).backgroundImage !== 'none' ||
        getComputedStyle(host, '::before').backgroundImage !== 'none'
      );
    });
    expect(baseIconVisible, `${link} retains its base icon`).toBe(true);
    await expect(regular.locator('.vscode-symlink-badge')).toHaveCount(0);
  }
  await expect(page.locator('.vscode-symlink-badge')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/symlinks-light.png' });
  await page.theme.setTheme('JupyterLab Dark');
  await expect(
    row(page, 'linked.js').locator('.vscode-symlink-badge')
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/symlinks-dark.png' });
});

test('refresh removes the badge when a link becomes a regular file', async ({
  page,
  tmpPath
}) => {
  const path = `${tmpPath}/linked.js`;
  await page.filebrowser.openDirectory(tmpPath);
  await expect(
    row(page, 'linked.js').locator('.vscode-symlink-badge')
  ).toBeVisible();
  await unlink(diskPath(path));
  await writeFile(diskPath(path), '// regular now');
  await page.filebrowser.refresh();
  await expect(
    row(page, 'linked.js').locator('.vscode-symlink-badge')
  ).toHaveCount(0);
});

test('an earlier directory response cannot badge a regular file', async ({
  page,
  tmpPath
}) => {
  const ordinary = `${tmpPath}/ordinary`;
  await mkdir(diskPath(ordinary));
  await writeFile(diskPath(`${ordinary}/linked.js`), '// regular file');
  let release!: () => void;
  const delayed = new Promise<void>(resolve => {
    release = resolve;
  });
  let intercepted!: () => void;
  const seen = new Promise<void>(resolve => {
    intercepted = resolve;
  });
  await page.route('**/vscode-icons/symlinks?*', async route => {
    if (new URL(route.request().url()).searchParams.get('path') === tmpPath) {
      const response = await route.fetch();
      intercepted();
      await delayed;
      await route.fulfill({ response });
    } else {
      await route.continue();
    }
  });
  await page.filebrowser.openDirectory(tmpPath);
  await seen;
  await page.filebrowser.openDirectory(ordinary);
  const ordinaryResponse = page.waitForResponse(
    response =>
      response.url().includes('/vscode-icons/symlinks?') &&
      new URL(response.url()).searchParams.get('path') === ordinary
  );
  await page.filebrowser.refresh();
  await ordinaryResponse;
  const earlierResponse = page.waitForResponse(
    response =>
      response.url().includes('/vscode-icons/symlinks?') &&
      new URL(response.url()).searchParams.get('path') === tmpPath
  );
  release();
  await earlierResponse;
  await page.unrouteAll({ behavior: 'wait' });
  await page.evaluate(
    () =>
      new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
  await expect(row(page, 'linked.js')).toBeVisible();
  await expect(
    row(page, 'linked.js').locator('.vscode-symlink-badge')
  ).toHaveCount(0);
});
