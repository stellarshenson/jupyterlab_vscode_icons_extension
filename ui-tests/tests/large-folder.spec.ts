import { expect, test } from '@jupyterlab/galata';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Row passes in a large folder - DEF-ICONS-70.
 *
 * JupyterLab delivers about one mutation callback per row while it renders a
 * listing, and every row pass walks every row, so a pass per callback made a
 * 1,000-entry folder open in 14.4 s against 1.7 s without the extension. The
 * passes run once per animation frame instead.
 *
 * Wall time is not asserted, because it depends on the machine. Each
 * markRowIcons pass reads the listing panel's computed background once, so
 * the number of those reads counts the passes.
 */

const diskPath = (path: string) =>
  join(process.env.JUPYTERLAB_GALATA_ROOT_DIR!, path);

const ENTRIES = 1000;

test('opening a 1,000-entry folder runs far fewer row passes than rows', async ({
  page,
  tmpPath
}) => {
  test.setTimeout(120000);
  const dir = `${tmpPath}/big`;
  await mkdir(diskPath(dir));
  for (let i = 0; i < ENTRIES; i++) {
    await writeFile(diskPath(`${dir}/f${i}.txt`), 'x');
  }
  await page.evaluate(() => {
    const w = window as any;
    w.__panelStyleReads = 0;
    const original = window.getComputedStyle.bind(window);
    window.getComputedStyle = ((element: Element, pseudo?: string | null) => {
      if (element.classList?.contains('jp-DirListing-content')) {
        w.__panelStyleReads++;
      }
      return original(element, pseudo);
    }) as typeof window.getComputedStyle;
  });
  await page.filebrowser.openDirectory(dir);
  await expect(page.locator('.jp-DirListing-item')).toHaveCount(ENTRIES);
  await page.waitForTimeout(1000);
  const passes = await page.evaluate(() => (window as any).__panelStyleReads);
  expect(passes).toBeGreaterThan(0);
  expect(passes).toBeLessThan(ENTRIES / 5);
});
