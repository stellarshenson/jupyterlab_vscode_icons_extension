import { expect, test } from '@jupyterlab/galata';

/**
 * Shell script icons - ACC-COLOUR-14.
 *
 * A script's platform has to be readable from its icon: the unix shells carry
 * the terminal tile, DOS batch carries the console tile in a different colour,
 * and PowerShell carries its own glyph. The test reads the rendered fill of
 * each tile rather than the source, so a CSS rule that collapsed the two
 * colours into one would fail it.
 */

const FIXTURES: Array<[string, string]> = [
  ['deploy.sh', 'vscode-shell'],
  ['build.bash', 'vscode-shell'],
  ['setup.zsh', 'vscode-shell'],
  ['run.bat', 'vscode-batch'],
  ['start.cmd', 'vscode-batch'],
  ['task.ps1', 'vscode-file-type-powershell']
];

test.describe('shell script icons', () => {
  test.beforeEach(async ({ page, tmpPath }) => {
    for (const [name] of FIXTURES) {
      await page.contents.uploadContent('x', 'text', `${tmpPath}/${name}`);
    }
    await page.filebrowser.openDirectory(tmpPath);
    await page.waitForSelector(
      '.jp-DirListing-item[data-file-type="vscode-shell"]',
      { timeout: 30000 }
    );
  });

  test('each script family resolves to its own file type', async ({ page }) => {
    const types = await page.evaluate(() => {
      const out: Record<string, string> = {};
      document.querySelectorAll('.jp-DirListing-item').forEach(row => {
        const label = row.querySelector('.jp-DirListing-itemText');
        if (label && label.textContent) {
          out[label.textContent.trim()] =
            row.getAttribute('data-file-type') || '(none)';
        }
      });
      return out;
    });
    for (const [name, expected] of FIXTURES) {
      expect(types[name], `${name} -> ${JSON.stringify(types)}`).toBe(expected);
    }
  });

  test('the unix tile and the batch tile are different colours', async ({
    page
  }) => {
    const fills = await page.evaluate(() => {
      const read = (fileName: string): string => {
        const label = [
          ...document.querySelectorAll('.jp-DirListing-itemText')
        ].find(n => n.textContent!.trim() === fileName);
        const item = label ? label.closest('.jp-DirListing-item') : null;
        const tile = item
          ? item.querySelector('.jp-DirListing-itemIcon svg path')
          : null;
        return tile ? getComputedStyle(tile).fill : 'no-tile';
      };
      return { sh: read('deploy.sh'), bat: read('run.bat') };
    });
    expect(fills.sh, JSON.stringify(fills)).not.toBe('no-tile');
    expect(fills.bat, JSON.stringify(fills)).not.toBe('no-tile');
    expect(fills.sh, JSON.stringify(fills)).not.toBe(fills.bat);
  });
});
