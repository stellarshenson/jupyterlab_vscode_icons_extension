import { expect, test } from '@jupyterlab/galata';

/**
 * Row stability - ACC-ICONS-4, ACC-CLASH-10 and ACC-CLASH-11.
 *
 * The file browser reuses its row elements, and this extension paints onto
 * them from a debounced observer. Two failures follow from that: a row can
 * keep the previous file's glyph after the listing changes, and an override
 * can stop being re-applied once the user navigates. Both are checked by
 * reading every row against its own file name rather than one row in
 * isolation.
 */

// Extensions no fileTypeConfigs entry claims, so the row is painted with an
// inline background and carries the marker that names the glyph.
const PAINTED: Record<string, string> = {
  'alpha.log': 'file-type-log',
  'beta.jar': 'file-type-jar',
  'gamma.wasm': 'file-type-wasm',
  'delta.proto': 'file-type-protobuf'
};

const OTHER: Record<string, string> = {
  'epsilon.graphql': 'file-type-graphql',
  'zeta.class': 'file-type-class'
};

type Painted = Record<string, string | null>;

const paintedByName = (page: any): Promise<Painted> =>
  page.evaluate(() => {
    const out: Record<string, string | null> = {};
    document.querySelectorAll('.jp-DirListing-item').forEach(row => {
      const label = row.querySelector('.jp-DirListing-itemText');
      const host = row.querySelector('.jp-DirListing-itemIcon');
      if (label && label.textContent) {
        out[label.textContent.trim()] = host
          ? host.getAttribute('data-vscode-row-icon')
          : 'no-host';
      }
    });
    return out;
  });

const waitPainted = (page: any, name: string): Promise<void> =>
  page.waitForFunction(
    (fileName: string) => {
      const label = [
        ...document.querySelectorAll('.jp-DirListing-itemText')
      ].find(n => n.textContent!.trim() === fileName);
      const item = label ? label.closest('.jp-DirListing-item') : null;
      const host = item ? item.querySelector('.jp-DirListing-itemIcon') : null;
      return !!host && host.hasAttribute('data-vscode-row-icon');
    },
    name,
    { timeout: 30000 }
  );

test.describe('rows the browser reuses', () => {
  test.beforeEach(async ({ page, tmpPath }) => {
    for (const name of Object.keys(PAINTED)) {
      await page.contents.uploadContent('x', 'text', `${tmpPath}/${name}`);
    }
    for (const name of Object.keys(OTHER)) {
      await page.contents.uploadContent('x', 'text', `${tmpPath}/sub/${name}`);
    }
  });

  test('every row keeps its own glyph across navigation', async ({
    page,
    tmpPath
  }) => {
    // ACC-CLASH-11: the observer re-marks on every browser mutation, so the
    // overrides have to survive repeated navigation, not just the first paint.
    // ACC-ICONS-4: a reused row must show the new file's glyph, never the
    // one it held for the previous listing - the rows in `sub` are different
    // files with different glyphs, so a stale marker shows up as a name in
    // one map carrying a glyph from the other.
    for (let pass = 0; pass < 5; pass++) {
      await page.filebrowser.openDirectory(tmpPath);
      await waitPainted(page, 'alpha.log');
      const top = await paintedByName(page);
      for (const [name, glyph] of Object.entries(PAINTED)) {
        expect(
          top[name],
          `pass ${pass}: ${name} -> ${JSON.stringify(top)}`
        ).toBe(glyph);
      }
      for (const name of Object.keys(OTHER)) {
        expect(
          top[name],
          `pass ${pass}: ${name} leaked into the parent`
        ).toBeUndefined();
      }

      await page.filebrowser.openDirectory(`${tmpPath}/sub`);
      await waitPainted(page, 'epsilon.graphql');
      const inner = await paintedByName(page);
      for (const [name, glyph] of Object.entries(OTHER)) {
        expect(
          inner[name],
          `pass ${pass}: ${name} -> ${JSON.stringify(inner)}`
        ).toBe(glyph);
      }
      for (const name of Object.keys(PAINTED)) {
        expect(
          inner[name],
          `pass ${pass}: ${name} survived into the subdirectory`
        ).toBeUndefined();
      }
    }
  });

  test('a hand-drawn override clears the host background', async ({
    page,
    tmpPath
  }) => {
    // ACC-CLASH-10: a .pdf row is painted through a ::before background, and
    // the host must not also carry one - two stacked glyphs was the critical
    // defect behind the suppression rules. The marker test is the ::before
    // still carrying its art, so this cannot pass by painting nothing at all.
    await page.contents.uploadContent('x', 'text', `${tmpPath}/report.pdf`);
    await page.filebrowser.openDirectory(tmpPath);
    await page.waitForSelector('.jp-DirListing-item[data-vscode-pdf]', {
      timeout: 30000
    });
    const row = await page.evaluate(() => {
      const item = document.querySelector(
        '.jp-DirListing-item[data-vscode-pdf]'
      );
      const host = item
        ? (item.querySelector('.jp-DirListing-itemIcon') as HTMLElement | null)
        : null;
      if (!host) {
        return { host: 'missing', before: 'missing' };
      }
      const inner = host.querySelector('svg, img:not(.vscode-exec-badge)');
      const innerBox = inner ? inner.getBoundingClientRect() : null;
      return {
        host: getComputedStyle(host).backgroundImage,
        before: getComputedStyle(host, '::before').backgroundImage,
        innerDisplay: inner ? getComputedStyle(inner).display : 'no-inner',
        innerArea: innerBox ? Math.round(innerBox.width * innerBox.height) : 0
      };
    });
    // The host-background guard exists for the two families whose provider
    // paints the host - .db and .bpmn - and not for .pdf, where nothing ever
    // sets it, so asserting it here could not fail. The innerArea assertion
    // below is what carries ACC-CLASH-10 for this fixture.
    expect(row.before, JSON.stringify(row)).toContain('url(');
    // What the criterion is really about: the icon JupyterLab put in the host
    // must not render under the override art.
    expect(row.innerArea, JSON.stringify(row)).toBe(0);
  });
});

test.describe('a renamed file', () => {
  // The painters are driven by MutationObservers. JupyterLab renames in place:
  // the label is a Lumino VirtualText node whose textContent is rewritten, and
  // where the icon JupyterLab itself resolves does not change, LabIcon.element
  // returns without touching the DOM. Neither produces a childList record, so
  // an observer watching childList alone never re-runs and the row keeps the
  // glyph of the file that used to carry that name.
  test('takes the icon of its new name', async ({ page, tmpPath }) => {
    await page.contents.uploadContent('x', 'text', `${tmpPath}/renamed.log`);
    await page.filebrowser.openDirectory(tmpPath);
    await waitPainted(page, 'renamed.log');

    await page.contents.renameFile(
      `${tmpPath}/renamed.log`,
      `${tmpPath}/renamed.jar`
    );
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('.jp-DirListing-itemText')].some(
          n => n.textContent!.trim() === 'renamed.jar'
        ),
      undefined,
      { timeout: 30000 }
    );
    await waitPainted(page, 'renamed.jar');
    const after = await paintedByName(page);
    expect(after['renamed.jar'], JSON.stringify(after)).toBe('file-type-jar');
    expect(after['renamed.log'], JSON.stringify(after)).toBeUndefined();
  });
});

test.describe('painted rows stay visible', () => {
  // DEF-COLOUR-43: the row painter put vendor artwork drawn for VSCode's dark
  // sidebar onto a light listing with none of the measure the tab painter runs.
  // Measured against --jp-layout-color1: file-type-gradle 1.33:1,
  // file-type-log 2.21:1, file-type-class 2.93:1, where the glyph JupyterLab
  // drew before this painter existed was 6.19:1. The row now takes the same
  // decision the tab does, and marks what cannot clear 3:1.
  test('a low-contrast row glyph is marked and a legible one is not', async ({
    page,
    tmpPath
  }) => {
    await page.contents.uploadContent('x', 'text', `${tmpPath}/trace.log`);
    await page.contents.uploadContent('x', 'text', `${tmpPath}/lib.jar`);
    await page.filebrowser.openDirectory(tmpPath);
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('.jp-DirListing-item')].filter(r => {
          const host = r.querySelector('.jp-DirListing-itemIcon');
          return !!host && host.hasAttribute('data-vscode-row-icon');
        }).length >= 2,
      undefined,
      { timeout: 30000 }
    );
    const rows = await page.evaluate(() => {
      const read = (name: string) => {
        const label = [
          ...document.querySelectorAll('.jp-DirListing-itemText')
        ].find(n => n.textContent!.trim() === name);
        const item = label ? label.closest('.jp-DirListing-item') : null;
        const host = item
          ? (item.querySelector('.jp-DirListing-itemIcon') as HTMLElement)
          : null;
        return {
          painted: host ? host.getAttribute('data-vscode-row-icon') : null,
          outlined: host ? host.hasAttribute('data-vscode-row-outline') : null
        };
      };
      return { log: read('trace.log'), jar: read('lib.jar') };
    });
    expect(rows.log.painted, JSON.stringify(rows)).toBe('file-type-log');
    // 2.21:1 on the light listing, so it must be marked.
    expect(rows.log.outlined, JSON.stringify(rows)).toBe(true);
    // The jar glyph clears the bar on its own; marking it would be noise.
    expect(rows.jar.painted, JSON.stringify(rows)).toBe('file-type-jar');
    expect(rows.jar.outlined, JSON.stringify(rows)).toBe(false);
  });
});
