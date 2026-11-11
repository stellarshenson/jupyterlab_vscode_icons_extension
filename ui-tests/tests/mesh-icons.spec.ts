import { expect, test } from '@jupyterlab/galata';

/**
 * The shared 3D mesh glyph - ACC-ICONS-81-MESH-ICON.
 *
 * The seven extensions the advanced image viewer opens resolve through this
 * extension's mapping to one custom body. The row painter consults
 * getIconForFile before any foreign icon, so every row carries this
 * extension's key and artwork. The advanced image viewer is installed in the
 * bubblewrap runner and registers these rows; its svg stays in the row,
 * hidden under this extension's painted glyph.
 */

const MESH = ['stl', 'ply', '3mf', 'step', 'stp', 'obj', 'glb'];
const FILLS = ['#9adcf5', '#4a9fd4', '#2e79a8'];
const SELECTED_FILLS = ['#ffffff', '#202020', '#000000'];

const meshNames = (): string[] => MESH.map(ext => `part.${ext}`);

// JupyterLab writes a row's label synchronously but resolves its icon inside
// a requestAnimationFrame callback in the same pass, and the file browser
// reuses row elements. Waiting two frames lets that callback run.
const settleIcons = (page: any): Promise<void> =>
  page.evaluate(
    () =>
      new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );

const waitForMeshRows = (page: any): Promise<void> =>
  page.waitForFunction(
    (names: string[]) =>
      names.every(name => {
        const label = [
          ...document.querySelectorAll('.jp-DirListing-itemText')
        ].find(n => n.textContent!.trim() === name);
        const item = label ? label.closest('.jp-DirListing-item') : null;
        const host = item
          ? item.querySelector('.jp-DirListing-itemIcon')
          : null;
        return (
          !!host &&
          host.getAttribute('data-vscode-row-icon') === 'file-type-mesh'
        );
      }),
    meshNames(),
    { timeout: 30000 }
  );

const readRows = (
  page: any,
  names: string[]
): Promise<Record<string, { painted: string | null; background: string }>> =>
  page.evaluate((wanted: string[]) => {
    const out: Record<string, { painted: string | null; background: string }> =
      {};
    for (const name of wanted) {
      const label = [
        ...document.querySelectorAll('.jp-DirListing-itemText')
      ].find(n => n.textContent!.trim() === name);
      const item = label ? label.closest('.jp-DirListing-item') : null;
      const host = item
        ? (item.querySelector('.jp-DirListing-itemIcon') as HTMLElement | null)
        : null;
      out[name] = {
        painted: host ? host.getAttribute('data-vscode-row-icon') : 'no-host',
        background: host ? host.style.backgroundImage : 'no-host'
      };
    }
    return out;
  }, names);

test.describe('mesh icons', () => {
  test.beforeEach(async ({ page, tmpPath }) => {
    for (const name of meshNames()) {
      await page.contents.uploadContent('x', 'text', `${tmpPath}/${name}`);
    }
    await page.filebrowser.openDirectory(tmpPath);
    await settleIcons(page);
  });

  test('all seven mesh extensions paint the shared cube', async ({ page }) => {
    await waitForMeshRows(page);
    await settleIcons(page);
    const rows = await readRows(page, meshNames());
    for (const name of meshNames()) {
      expect(rows[name].painted, JSON.stringify(rows)).toBe('file-type-mesh');
    }
  });

  test('all seven rows carry the same artwork with the three face colours', async ({
    page
  }) => {
    await waitForMeshRows(page);
    await settleIcons(page);
    const rows = await readRows(page, meshNames());
    const backgrounds = meshNames().map(name => rows[name].background);
    expect(new Set(backgrounds).size, JSON.stringify(rows)).toBe(1);
    const artwork = decodeURIComponent(backgrounds[0]);
    expect(artwork).toContain('viewBox="0 0 32 32"');
    for (const fill of FILLS) {
      expect(artwork).toContain(`fill="${fill}"`);
    }
  });

  test('a selected mesh row swaps in the recolour and restores on deselect', async ({
    page
  }) => {
    await waitForMeshRows(page);
    await settleIcons(page);
    // The painter writes the base artwork inline, so a selected row's variant
    // is only visible through the computed style the stylesheet rule sets.
    const readMesh = () =>
      page.evaluate(() => {
        const label = [
          ...document.querySelectorAll('.jp-DirListing-itemText')
        ].find(n => n.textContent!.trim() === 'part.stl');
        const item = label ? label.closest('.jp-DirListing-item') : null;
        const host = item
          ? (item.querySelector(
              '.jp-DirListing-itemIcon'
            ) as HTMLElement | null)
          : null;
        return {
          selected: item ? item.classList.contains('jp-mod-selected') : false,
          painted: host ? host.getAttribute('data-vscode-row-icon') : 'no-host',
          background: host ? getComputedStyle(host).backgroundImage : 'none'
        };
      });

    const meshRow = page.locator('.jp-DirListing-item').filter({
      has: page.locator('.jp-DirListing-itemText', { hasText: /^part\.stl$/ })
    });
    const otherRow = page.locator('.jp-DirListing-item').filter({
      has: page.locator('.jp-DirListing-itemText', { hasText: /^part\.ply$/ })
    });

    const unselected = await readMesh();
    expect(unselected.selected, JSON.stringify(unselected)).toBe(false);
    expect(unselected.painted, JSON.stringify(unselected)).toBe(
      'file-type-mesh'
    );
    const base = decodeURIComponent(unselected.background);
    for (const fill of FILLS) {
      expect(base, JSON.stringify(unselected)).toContain(`fill="${fill}"`);
    }

    await meshRow.click();
    await expect(meshRow).toHaveClass(/jp-mod-selected/);
    const selected = await readMesh();
    const variant = decodeURIComponent(selected.background);
    for (const fill of SELECTED_FILLS) {
      expect(variant, JSON.stringify(selected)).toContain(`fill="${fill}"`);
    }
    for (const fill of FILLS) {
      expect(variant, JSON.stringify(selected)).not.toContain(`fill="${fill}"`);
    }
    expect(selected.painted, JSON.stringify(selected)).toBe('file-type-mesh');

    await otherRow.click();
    await expect(meshRow).not.toHaveClass(/jp-mod-selected/);
    const restored = await readMesh();
    const baseAgain = decodeURIComponent(restored.background);
    for (const fill of FILLS) {
      expect(baseAgain, JSON.stringify(restored)).toContain(`fill="${fill}"`);
    }
    expect(restored.painted, JSON.stringify(restored)).toBe('file-type-mesh');
  });
});
