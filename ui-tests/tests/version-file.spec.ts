import { expect, galata, test } from '@jupyterlab/galata';

/**
 * VERSION shows what a .txt shows - ACC-ICONS-82-VERSION-TEXT.
 *
 * Round 1 mapped the name to file-type-text, but a .txt row and tab in the
 * default settings show this extension's custom 3800x4800 TXT sheet: the
 * vscode-txt registration paints the tab (registry:vscode-txt) and the
 * data-vscode-txt ::before rule paints the row. VERSION therefore takes the
 * same registration through the pattern ^(VERSION|version)$ and the same row
 * override, so the two files must be indistinguishable on both surfaces.
 *
 * With enableDocIcons off the registration is skipped and VERSION falls back
 * to the plain file-type-text glyph from the extensionToIcon mapping. A live
 * settings toggle cannot exercise that state: registration runs at activation
 * and the extension itself asks for a page refresh, so each state is a
 * separate lab load through Galata's mockSettings, the mechanism
 * settings-groups.spec.ts uses.
 */

const PLUGIN = '@stellarshenson/jupyterlab-vscode-icons-extension:plugin';

const SHEET_VIEWBOX = 'viewBox="0 0 3800 4800"';
const GLYPH_VIEWBOX = 'viewBox="0 0 32 32"';

type RowState = {
  found: boolean;
  fileType: string | null;
  txt: boolean;
  icon: string | null;
  painted: string | null;
  before: string;
  svg: string;
};

const readRow = (page: any, name: string): Promise<RowState> =>
  page.evaluate((fileName: string) => {
    const label = [
      ...document.querySelectorAll('.jp-DirListing-itemText')
    ].find(n => n.textContent!.trim() === fileName);
    const item = label ? label.closest('.jp-DirListing-item') : null;
    const host = item
      ? (item.querySelector('.jp-DirListing-itemIcon') as HTMLElement | null)
      : null;
    const before = host
      ? getComputedStyle(host, '::before').backgroundImage
      : '';
    const payload = before.match(/base64,([^")]+)/);
    const svg = host ? host.querySelector('svg') : null;
    return {
      found: !!item,
      fileType: item ? item.getAttribute('data-file-type') : null,
      txt: !!item && item.hasAttribute('data-vscode-txt'),
      icon: svg ? svg.getAttribute('data-icon') : null,
      painted: host ? host.getAttribute('data-vscode-row-icon') : null,
      before,
      svg: payload ? atob(payload[1]) : ''
    };
  }, name);

const upload = async (
  page: any,
  tmpPath: string,
  names: string[]
): Promise<void> => {
  for (const name of names) {
    await page.contents.uploadContent('x', 'text', `${tmpPath}/${name}`);
  }
  await page.filebrowser.openDirectory(tmpPath);
};

const settle = (page: any): Promise<void> =>
  page.evaluate(
    () =>
      new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );

// Both rows are claimed by the doc-icons override, which runs from a debounced
// pass that the listing re-triggers on reuse; waiting for the attribute on
// both is the signal that the pass has run.
const waitForTxtRows = (page: any): Promise<void> =>
  page.waitForFunction(
    () => {
      const row = (fileName: string) => {
        const label = [
          ...document.querySelectorAll('.jp-DirListing-itemText')
        ].find(n => n.textContent!.trim() === fileName);
        return label ? label.closest('.jp-DirListing-item') : null;
      };
      return (
        !!row('VERSION')?.hasAttribute('data-vscode-txt') &&
        !!row('notes.txt')?.hasAttribute('data-vscode-txt')
      );
    },
    undefined,
    { timeout: 30000 }
  );

test.describe('doc icons on - VERSION matches the .txt control', () => {
  test.beforeEach(async ({ page, tmpPath }) => {
    await upload(page, tmpPath, ['VERSION', 'notes.txt']);
    await waitForTxtRows(page);
    await settle(page);
  });

  test('both rows paint the same custom TXT sheet', async ({ page }) => {
    const version = await readRow(page, 'VERSION');
    const notes = await readRow(page, 'notes.txt');
    const rows = JSON.stringify({ version, notes });
    expect(version.found, rows).toBe(true);
    expect(notes.found, rows).toBe(true);
    // The pattern claims VERSION for vscode-txt; notes.txt keeps the built-in
    // text type, which is why its row was already painted before this change.
    expect(version.fileType, rows).toBe('vscode-txt');
    expect(notes.fileType, rows).toBe('text');
    expect(version.txt, rows).toBe(true);
    expect(notes.txt, rows).toBe(true);
    // Neither row uses the fallback painter: the ::before rule paints both.
    expect(version.painted, rows).toBeNull();
    expect(notes.painted, rows).toBeNull();
    expect(version.before, rows).not.toBe('none');
    expect(version.before, rows).toBe(notes.before);
    expect(version.svg, rows).toContain('<svg');
    expect(version.svg, rows).toContain(SHEET_VIEWBOX);
    expect(notes.svg, rows).toBe(version.svg);
  });

  test('both tabs carry registry:vscode-txt', async ({ page, tmpPath }) => {
    await page.evaluate(
      async (paths: string[]) => {
        for (const path of paths) {
          await (window as any).jupyterapp.commands.execute('docmanager:open', {
            path,
            factory: 'Editor'
          });
        }
      },
      [`${tmpPath}/VERSION`, `${tmpPath}/notes.txt`]
    );
    await page.waitForFunction(
      () => {
        const tab = (label: string) => {
          const found = [
            ...document.querySelectorAll(
              '.lm-TabBar-tab[data-type="document-title"]'
            )
          ].find(
            t =>
              t.querySelector('.lm-TabBar-tabLabel')?.textContent?.trim() ===
              label
          );
          return found ? found.querySelector('.lm-TabBar-tabIcon') : null;
        };
        const version = tab('VERSION');
        const notes = tab('notes.txt');
        return (
          version?.getAttribute('data-vscode-tab-icon') ===
            'registry:vscode-txt' &&
          notes?.getAttribute('data-vscode-tab-icon') === 'registry:vscode-txt'
        );
      },
      undefined,
      { timeout: 30000 }
    );
    const tabs = await page.evaluate(() => {
      const read = (label: string) => {
        const found = [
          ...document.querySelectorAll(
            '.lm-TabBar-tab[data-type="document-title"]'
          )
        ].find(
          t =>
            t.querySelector('.lm-TabBar-tabLabel')?.textContent?.trim() ===
            label
        );
        const host = found
          ? (found.querySelector('.lm-TabBar-tabIcon') as HTMLElement | null)
          : null;
        const background = host ? host.style.backgroundImage : '';
        const b64 = background.match(/base64,([^")]+)/);
        const utf8 = background.match(/utf8,([^")]+)/);
        return {
          painted: host ? host.getAttribute('data-vscode-tab-icon') : 'no-host',
          svg: b64 ? atob(b64[1]) : utf8 ? decodeURIComponent(utf8[1]) : ''
        };
      };
      return { version: read('VERSION'), notes: read('notes.txt') };
    });
    const both = JSON.stringify(tabs);
    expect(tabs.version.painted, both).toBe('registry:vscode-txt');
    expect(tabs.notes.painted, both).toBe('registry:vscode-txt');
    // The tab painter writes an encoded data URI, not base64; the decoded
    // payload is the tab's own recolour variant of the same sheet.
    expect(tabs.version.svg, both).toContain('<svg');
    expect(tabs.version.svg, both).toContain(SHEET_VIEWBOX);
    expect(tabs.notes.svg, both).toContain(SHEET_VIEWBOX);
  });

  test('requirements.txt keeps its python icon', async ({ page, tmpPath }) => {
    // The guard the VERSION exception sits beside: a .txt this extension
    // registered under another of its own types must keep that icon.
    await upload(page, tmpPath, ['requirements.txt', 'notes.txt']);
    await page.waitForFunction(
      () => {
        const label = [
          ...document.querySelectorAll('.jp-DirListing-itemText')
        ].find(n => n.textContent!.trim() === 'requirements.txt');
        const item = label ? label.closest('.jp-DirListing-item') : null;
        return (
          !!item &&
          item.getAttribute('data-file-type') === 'vscode-file-type-python'
        );
      },
      undefined,
      { timeout: 30000 }
    );
    await waitForTxtRows(page);
    const requirement = await readRow(page, 'requirements.txt');
    const notes = await readRow(page, 'notes.txt');
    const rows = JSON.stringify({ requirement, notes });
    expect(requirement.fileType, rows).toBe('vscode-file-type-python');
    expect(requirement.txt, rows).toBe(false);
    expect(notes.txt, rows).toBe(true);
    const owner = await page.evaluate(() => {
      const label = [
        ...document.querySelectorAll('.jp-DirListing-itemText')
      ].find(n => n.textContent!.trim() === 'requirements.txt');
      const item = label ? label.closest('.jp-DirListing-item') : null;
      const svg = item?.querySelector('.jp-DirListing-itemIcon svg');
      return svg ? svg.getAttribute('data-icon') : null;
    });
    expect(owner, rows).toBe('vscode-icons:file-type-python');
  });

  test('a folder named VERSION keeps its folder icon', async ({
    page,
    tmpPath
  }) => {
    // Folders are not files: the row override must not claim a directory whose
    // name matches the VERSION name or the .txt extension (ACC-ICONS-82).
    await page.contents.createDirectory(`${tmpPath}/folder/VERSION`);
    await page.filebrowser.openDirectory(`${tmpPath}/folder`);
    await page.waitForFunction(
      () => {
        const label = [
          ...document.querySelectorAll('.jp-DirListing-itemText')
        ].find(n => n.textContent!.trim() === 'VERSION');
        const item = label ? label.closest('.jp-DirListing-item') : null;
        return !!item && item.getAttribute('data-file-type') === 'directory';
      },
      undefined,
      { timeout: 30000 }
    );
    await settle(page);
    const folder = await readRow(page, 'VERSION');
    const rows = JSON.stringify({ folder });
    expect(folder.found, rows).toBe(true);
    expect(folder.fileType, rows).toBe('directory');
    // JupyterLab 4.6 gives a directory row no jp-DirListing-directory class;
    // its folder identity is the directory file type and the folder icon.
    expect(folder.icon, rows).toBe('ui-components:folder');
    expect(folder.txt, rows).toBe(false);
    expect(folder.before, rows).toBe('none');
  });

  test('a mixed-case Version file takes the same registration', async ({
    page,
    tmpPath
  }) => {
    // The row branch lowercases the name; the registration must claim every
    // case combination too, or the tab falls back while the row is painted.
    await upload(page, tmpPath, ['Version']);
    await page.waitForFunction(
      () => {
        const label = [
          ...document.querySelectorAll('.jp-DirListing-itemText')
        ].find(n => n.textContent!.trim() === 'Version');
        const item = label ? label.closest('.jp-DirListing-item') : null;
        return (
          !!item &&
          item.hasAttribute('data-vscode-txt') &&
          item.getAttribute('data-file-type') === 'vscode-txt'
        );
      },
      undefined,
      { timeout: 30000 }
    );
    const version = await readRow(page, 'Version');
    const rows = JSON.stringify({ version });
    expect(version.fileType, rows).toBe('vscode-txt');
    expect(version.txt, rows).toBe(true);
    await page.evaluate(
      async (paths: string[]) => {
        for (const path of paths) {
          await (window as any).jupyterapp.commands.execute('docmanager:open', {
            path,
            factory: 'Editor'
          });
        }
      },
      [`${tmpPath}/Version`, `${tmpPath}/notes.txt`]
    );
    await page.waitForFunction(
      () => {
        const tab = (label: string) => {
          const found = [
            ...document.querySelectorAll(
              '.lm-TabBar-tab[data-type="document-title"]'
            )
          ].find(
            t =>
              t.querySelector('.lm-TabBar-tabLabel')?.textContent?.trim() ===
              label
          );
          return found ? found.querySelector('.lm-TabBar-tabIcon') : null;
        };
        return (
          tab('Version')?.getAttribute('data-vscode-tab-icon') ===
            'registry:vscode-txt' &&
          tab('notes.txt')?.getAttribute('data-vscode-tab-icon') ===
            'registry:vscode-txt'
        );
      },
      undefined,
      { timeout: 30000 }
    );
    const tabs = await page.evaluate(() => {
      const read = (label: string) => {
        const found = [
          ...document.querySelectorAll(
            '.lm-TabBar-tab[data-type="document-title"]'
          )
        ].find(
          t =>
            t.querySelector('.lm-TabBar-tabLabel')?.textContent?.trim() ===
            label
        );
        const icon = found ? found.querySelector('.lm-TabBar-tabIcon') : null;
        return icon ? icon.getAttribute('data-vscode-tab-icon') : 'no-host';
      };
      return { version: read('Version'), notes: read('notes.txt') };
    });
    const both = JSON.stringify(tabs);
    expect(tabs.version, both).toBe('registry:vscode-txt');
    expect(tabs.version, both).toBe(tabs.notes);
  });
});

test.describe('doc icons off - VERSION falls back to file-type-text', () => {
  test.use({
    mockSettings: {
      ...galata.DEFAULT_SETTINGS,
      [PLUGIN]: { enableDocIcons: false }
    }
  });

  test('the fallback glyph replaces the sheet on VERSION', async ({
    page,
    tmpPath
  }) => {
    await upload(page, tmpPath, ['VERSION', 'notes.txt']);
    await page.waitForFunction(
      () => {
        const label = [
          ...document.querySelectorAll('.jp-DirListing-itemText')
        ].find(n => n.textContent!.trim() === 'VERSION');
        const item = label ? label.closest('.jp-DirListing-item') : null;
        const host = item
          ? item.querySelector('.jp-DirListing-itemIcon')
          : null;
        return (
          !!host &&
          host.getAttribute('data-vscode-row-icon') === 'file-type-text'
        );
      },
      undefined,
      { timeout: 30000 }
    );
    await settle(page);
    const version = await readRow(page, 'VERSION');
    const notes = await readRow(page, 'notes.txt');
    const rows = JSON.stringify({ version, notes });
    // The registration is skipped, so VERSION falls back to the built-in text
    // type and the round 1 mapping paints file-type-text.
    expect(version.fileType, rows).toBe('text');
    expect(version.txt, rows).toBe(false);
    expect(version.painted, rows).toBe('file-type-text');
    expect(version.before, rows).toBe('none');
    const versionGlyph = await page.evaluate(() => {
      const label = [
        ...document.querySelectorAll('.jp-DirListing-itemText')
      ].find(n => n.textContent!.trim() === 'VERSION');
      const host = label
        ?.closest('.jp-DirListing-item')
        ?.querySelector('.jp-DirListing-itemIcon') as HTMLElement | null;
      return host ? decodeURIComponent(host.style.backgroundImage) : '';
    });
    expect(versionGlyph, rows).toContain(GLYPH_VIEWBOX);
    // The doc group owns the .txt family, so its sheet is withdrawn too; the
    // row keeps JupyterLab's own glyph rather than a painter attribute.
    expect(notes.fileType, rows).toBe('text');
    expect(notes.txt, rows).toBe(false);
    expect(notes.painted, rows).toBeNull();
    expect(notes.before, rows).toBe('none');
  });
});
