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

test('a badge never survives a directory change', async ({ page, tmpPath }) => {
  const ordinary = `${tmpPath}/ordinary`;
  await mkdir(diskPath(ordinary), { recursive: true });
  await writeFile(diskPath(`${ordinary}/linked.js`), '// regular file');
  // The flag rides on the listing the browser fetches, so the previous
  // directory's links cannot badge the next directory's regular file - the
  // state a delayed response used to leave behind, without the interception.
  await page.filebrowser.openDirectory(tmpPath);
  await expect(
    row(page, 'linked.js').locator('.vscode-symlink-badge')
  ).toHaveCount(1);
  await page.filebrowser.openDirectory(ordinary);
  await expect(
    row(page, 'linked.js').locator('.vscode-symlink-badge')
  ).toHaveCount(0);
});

test('a dot-named link is dimmed like any dotfile', async ({
  page,
  tmpPath
}) => {
  await writeFile(diskPath(`${tmpPath}/.plain-dotfile`), '');
  await symlink('target.js', diskPath(`${tmpPath}/.hidden-link`));
  await symlink(
    'target-folder',
    diskPath(`${tmpPath}/.hidden-folder-link`),
    'dir'
  );
  await page.evaluate(async () => {
    const commands = (window as any).jupyterapp.commands;
    if (!commands.isToggled('filebrowser:toggle-hidden-files')) {
      await commands.execute('filebrowser:toggle-hidden-files');
    }
  });
  await page.filebrowser.openDirectory(tmpPath);
  const opacity = (item: any) =>
    item.evaluate((node: Element) => getComputedStyle(node).opacity);
  const dimmed = await opacity(row(page, '.plain-dotfile'));
  expect(Number(dimmed)).toBeLessThan(1);
  // A hidden link reads as hidden: the badge says it is a link, the dim says
  // it is a dotfile, and neither cancels the other (DEF-LINK-76).
  for (const link of ['.hidden-link', '.hidden-folder-link']) {
    const item = row(page, link);
    await expect(item).toHaveAttribute('data-is-dot', 'true');
    await expect(item.locator('.vscode-symlink-badge')).toHaveCount(1);
    expect(await opacity(item)).toBe(dimmed);
  }
});
