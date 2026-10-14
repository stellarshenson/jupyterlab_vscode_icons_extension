import { expect, test } from '@jupyterlab/galata';

/**
 * File browser icons - ACC-ICONS-1 and ACC-ICONS-3.
 *
 * A row carries the name of the file type that resolved it in `data-file-type`,
 * and the icon element carries that type's icon name in `data-icon`. Both are
 * read here rather than a rendered pixel, so the assertion survives an artwork
 * change and still fails when a mapping is lost.
 */

// Extensions JupyterLab itself does not claim, so this extension's file type is
// the first match. Lab claims python, markdown, json, yaml, csv and the image
// types ahead of any extension, which DEF-ICONS-11 records.
// A dotfile is hidden in the browser by default, so none is used here.
const FIXTURES: Array<[string, string]> = [
  ['sample.js', 'vscode-file-type-js-official'],
  ['sample.ts', 'vscode-file-type-typescript-official'],
  ['sample.vue', 'vscode-file-type-vue']
];

// JupyterLab writes a row's label synchronously but resolves its icon inside
// a requestAnimationFrame callback in the same pass, and the file browser
// reuses row elements. A row found by its label can therefore still carry the
// previous row's glyph, which is what made the .bpmn assertion read
// `ui-components:folder`. Waiting two frames lets that callback run.
const settleIcons = (page: any): Promise<void> =>
  page.evaluate(
    () =>
      new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );

const rowFileTypes = async (page: any): Promise<Record<string, string>> =>
  page.evaluate(() => {
    const out: Record<string, string> = {};
    document.querySelectorAll('.jp-DirListing-item').forEach(row => {
      const name = row.querySelector('.jp-DirListing-itemText');
      if (name && name.textContent) {
        out[name.textContent.trim()] =
          row.getAttribute('data-file-type') || '(none)';
      }
    });
    return out;
  });

test.describe('file browser icons', () => {
  // Galata gives each test file its own directory on the server and the file
  // browser opens it; uploading to the server root would land outside the view.
  test.beforeEach(async ({ page, tmpPath }) => {
    for (const [name] of FIXTURES) {
      await page.contents.uploadContent('x', 'text', `${tmpPath}/${name}`);
    }
    await page.contents.uploadContent('x', 'text', `${tmpPath}/sample.qqzz`);
    await page.filebrowser.openDirectory(tmpPath);
    // The listing renders asynchronously after the directory change; reading it
    // before the rows land is what made this suite flake.
    await page.waitForSelector(
      '.jp-DirListing-item[data-file-type="vscode-file-type-js-official"]'
    );
    await settleIcons(page);
  });

  test('a mapped extension resolves to this extension file type', async ({
    page
  }) => {
    const types = await rowFileTypes(page);
    for (const [name, expected] of FIXTURES) {
      expect(types[name], `${name} should resolve to ${expected}`).toBe(
        expected
      );
    }
  });

  test('a mapped extension renders a vscode-icons glyph', async ({ page }) => {
    const icons = await page.evaluate(() => {
      const out: Record<string, string> = {};
      document.querySelectorAll('.jp-DirListing-item').forEach(row => {
        const name = row.querySelector('.jp-DirListing-itemText');
        const svg = row.querySelector('.jp-DirListing-itemIcon svg');
        if (name && name.textContent) {
          out[name.textContent.trim()] = svg
            ? svg.getAttribute('data-icon') || '(no data-icon)'
            : '(no svg)';
        }
      });
      return out;
    });
    expect(icons['sample.js']).toBe('vscode-icons:file-type-js-official');
    expect(icons['sample.ts']).toBe(
      'vscode-icons:file-type-typescript-official'
    );
  });

  // The extension replaces only JupyterLab's generic glyphs. Python is one of
  // JupyterLab's own specific icons, so it is kept - changing icons the project
  // already had is the regression this test exists to catch.
  test('a JupyterLab specific icon is kept, not replaced', async ({
    page,
    tmpPath
  }) => {
    await page.contents.uploadContent('x', 'text', `${tmpPath}/sample.py`);
    await page.filebrowser.openDirectory(tmpPath);
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('.jp-DirListing-itemText')].some(
          n => n.textContent!.trim() === 'sample.py'
        ),
      undefined,
      { timeout: 30000 }
    );
    await settleIcons(page);
    const row = await page.evaluate(() => {
      const item = [...document.querySelectorAll('.jp-DirListing-item')].find(
        r => {
          const n = r.querySelector('.jp-DirListing-itemText');
          return !!n && n.textContent!.trim() === 'sample.py';
        }
      );
      const host = item ? item.querySelector('.jp-DirListing-itemIcon') : null;
      const svg = host ? host.querySelector('svg') : null;
      return {
        painted: host ? host.getAttribute('data-vscode-row-icon') : 'no-host',
        icon: svg ? svg.getAttribute('data-icon') : 'no-svg'
      };
    });
    expect(row.icon).toBe('ui-components:python');
    expect(row.painted).toBeNull();
  });

  // A row this extension paints carries the glyph as a background-image on the
  // icon host, so the host must have a box for it to fill. JupyterLab 4.6.4
  // makes the row `display: inline-grid`, which makes the `flex: 0 0 20px` on
  // the host inert - the host is as wide as its in-flow children. The painter's
  // rule therefore hides the inner svg with `visibility: hidden`, keeping it in
  // flow, and this test is the guard: a rule that takes it out of flow, or a
  // JupyterLab layout change, shows up here as a zero box rather than as an
  // icon that quietly stops rendering. On this workstation the host measures
  // 20 x 19.5 either way, because jupyterlab_change_ui_font_size_fix sets the
  // row to `display: flex` - which is why the assertion is on a non-zero box
  // and not on those numbers. `.log` is a mapped extension that no
  // fileTypeConfigs entry claims, so it is painted rather than registered.
  test('a painted row has a box the background can fill', async ({
    page,
    tmpPath
  }) => {
    await page.contents.uploadContent('x', 'text', `${tmpPath}/trace.log`);
    await page.filebrowser.openDirectory(tmpPath);
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('.jp-DirListing-itemText')].some(
          n => n.textContent!.trim() === 'trace.log'
        ),
      undefined,
      { timeout: 30000 }
    );
    // The repaint runs from a debounced MutationObserver, so the marker is the
    // signal to wait for. A row that is never painted fails here, and a row
    // painted into a 0x0 box fails on the geometry below.
    await page.waitForFunction(
      () => {
        const label = [
          ...document.querySelectorAll('.jp-DirListing-itemText')
        ].find(n => n.textContent!.trim() === 'trace.log');
        const item = label ? label.closest('.jp-DirListing-item') : null;
        const host = item
          ? item.querySelector('.jp-DirListing-itemIcon')
          : null;
        return !!host && host.hasAttribute('data-vscode-row-icon');
      },
      undefined,
      { timeout: 30000 }
    );
    const row = await page.evaluate(() => {
      const label = [
        ...document.querySelectorAll('.jp-DirListing-itemText')
      ].find(n => n.textContent!.trim() === 'trace.log');
      const item = label ? label.closest('.jp-DirListing-item') : null;
      const host = item
        ? (item.querySelector('.jp-DirListing-itemIcon') as HTMLElement | null)
        : null;
      if (!host) {
        return { painted: 'no-host', width: 0, height: 0, background: 'none' };
      }
      const box = host.getBoundingClientRect();
      return {
        painted: host.getAttribute('data-vscode-row-icon'),
        width: Math.round(box.width),
        height: Math.round(box.height),
        background: getComputedStyle(host).backgroundImage.slice(0, 20)
      };
    });
    expect(row.painted, JSON.stringify(row)).not.toBeNull();
    expect(row.background, JSON.stringify(row)).not.toBe('none');
    expect(row.width, JSON.stringify(row)).toBeGreaterThan(0);
    expect(row.height, JSON.stringify(row)).toBeGreaterThan(0);
  });

  test('an unmapped extension keeps JupyterLab own file type', async ({
    page
  }) => {
    const types = await rowFileTypes(page);
    // ACC-ICONS-3: no vscode file type claims it, and the row is still listed.
    expect(types['sample.qqzz']).toBeDefined();
    expect(types['sample.qqzz'].startsWith('vscode-')).toBe(false);
  });
});

test.describe('deliberate deferrals to JupyterLab', () => {
  // CHANGELOG 1.0.25 chose JupyterLab's native markdown icon over the vscode
  // one, and the registration says so with `icon: markdownIcon`. The row
  // override must not quietly reverse that.
  test('a markdown row keeps JupyterLab own icon', async ({
    page,
    tmpPath
  }) => {
    await page.contents.uploadContent('x', 'text', `${tmpPath}/notes.md`);
    await page.filebrowser.openDirectory(tmpPath);
    await page.waitForSelector('.jp-DirListing-item');
    await settleIcons(page);
    const row = await page.evaluate(() => {
      const item = [...document.querySelectorAll('.jp-DirListing-item')].find(
        r => {
          const n = r.querySelector('.jp-DirListing-itemText');
          return !!n && n.textContent!.trim() === 'notes.md';
        }
      );
      const host = item ? item.querySelector('.jp-DirListing-itemIcon') : null;
      const svg = host ? host.querySelector('svg') : null;
      return {
        found: !!item,
        painted: host ? host.getAttribute('data-vscode-row-icon') : 'no-host',
        icon: svg ? svg.getAttribute('data-icon') : 'no-svg'
      };
    });
    expect(row.found).toBe(true);
    // this extension must not have repainted it
    expect(row.painted).toBeNull();
    expect(row.icon).toBe('ui-components:markdown');
  });
});

test.describe('icon ownership', () => {
  // ACC-ICONS-2: README.md has its own hand-built icon, distinct from the
  // markdown one, and it must not be collapsed into the generic markdown glyph.
  test('README.md keeps its own icon, not the markdown one', async ({
    page,
    tmpPath
  }) => {
    await page.contents.uploadContent('x', 'text', `${tmpPath}/README.md`);
    await page.contents.uploadContent('x', 'text', `${tmpPath}/CLAUDE.md`);
    await page.contents.uploadContent('x', 'text', `${tmpPath}/plain.md`);
    await page.filebrowser.openDirectory(tmpPath);
    await page.waitForSelector('.jp-DirListing-item');
    const types = await rowFileTypes(page);
    expect(types['README.md']).toBe('vscode-readme');
    // ACC-ICONS-2 names both files: CLAUDE.md has its own registration too,
    // and neither may collapse into the other or into plain markdown.
    expect(types['CLAUDE.md']).toBe('vscode-claude-md');
    expect(types['plain.md']).not.toBe('vscode-readme');
    expect(types['plain.md']).not.toBe('vscode-claude-md');
  });

  // ACC-TABS-31 / ACC-CLASH-9: an icon another extension registered is
  // specific and outranks this extension's. The assertion names the icon, not
  // just the absence of a repaint: `painted === null` alone is true for this
  // extension's own registrations too, so it could not fail for the rule.
  test('another extension icon is never replaced', async ({
    page,
    tmpPath
  }) => {
    // .zip is claimed by jupyterlab_zip_extension and by nothing in this
    // project, so the row carries that extension's own icon and this one has
    // no competing claim of its own to confuse the result. The subject used to
    // be .bpmn, which no longer tests the rule: the maintainer's instruction,
    // verbatim "we use ours", makes .bpmn a deliberate exception, proven by
    // `the bpmn row takes this extension's mark` below.
    await page.contents.uploadContent('x', 'text', `${tmpPath}/flow.zip`);
    await page.filebrowser.openDirectory(tmpPath);
    // Wait for this listing, not any listing: the previous directory's rows
    // already satisfy '.jp-DirListing-item'.
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('.jp-DirListing-itemText')].some(
          n => n.textContent!.trim() === 'flow.zip'
        ),
      undefined,
      { timeout: 30000 }
    );
    await settleIcons(page);
    // Walk up from the label so the icon read belongs to the same row: the
    // listing can hold a stale pane, and picking the first matching item by
    // query returned a folder.
    const row = await page.evaluate(() => {
      const label = [
        ...document.querySelectorAll('.jp-DirListing-itemText')
      ].find(n => n.textContent!.trim() === 'flow.zip');
      const item = label ? label.closest('.jp-DirListing-item') : null;
      const host = item ? item.querySelector('.jp-DirListing-itemIcon') : null;
      const svg = host ? host.querySelector('svg') : null;
      return {
        found: !!item,
        fileType: item ? item.getAttribute('data-file-type') : 'no-item',
        icon: svg ? svg.getAttribute('data-icon') : 'no-svg',
        painted: host ? host.getAttribute('data-vscode-row-icon') : 'no-host'
      };
    });
    expect(row.fileType).not.toBe('directory');
    expect(row.found).toBe(true);
    // Only this workstation has jupyterlab_zip_extension installed. CI installs
    // jupyterlab plus this project's wheel, where nothing claims .zip and there
    // is no competing claim to respect, so the case has nothing to prove there.
    test.skip(
      row.fileType !== 'zip',
      'no third-party zip provider installed in this environment'
    );
    expect(row.icon).toBe('jupyterlab_zip_extension:zip');
    expect(row.painted).toBeNull();
  });

  // DEF-TABS-23-3: the generic text sheet used to be stamped on every name
  // ending .txt, which painted it over requirements.txt - a name this project
  // maps to the python glyph through its own vscode-file-type-python type. The
  // maintainer's answer, verbatim: "python everywhere". The row and the tab are
  // both read, because the two resolve through different paths and it was their
  // disagreement that made the defect visible.
  test('requirements.txt keeps the python glyph, plain .txt does not', async ({
    page,
    tmpPath
  }) => {
    await page.contents.uploadContent(
      'x',
      'text',
      `${tmpPath}/requirements.txt`
    );
    await page.contents.uploadContent('x', 'text', `${tmpPath}/notes.txt`);
    await page.filebrowser.openDirectory(tmpPath);
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('.jp-DirListing-item')].some(r =>
          r.hasAttribute('data-vscode-txt')
        ),
      undefined,
      { timeout: 30000 }
    );
    await settleIcons(page);
    const rows = await page.evaluate(() => {
      const read = (name: string) => {
        const label = [
          ...document.querySelectorAll('.jp-DirListing-itemText')
        ].find(n => n.textContent!.trim() === name);
        const item = label ? label.closest('.jp-DirListing-item') : null;
        const host = item
          ? item.querySelector('.jp-DirListing-itemIcon')
          : null;
        return {
          fileType: item ? item.getAttribute('data-file-type') : 'no-item',
          txtSheet: item ? item.hasAttribute('data-vscode-txt') : 'no-item',
          svgHidden:
            host && host.querySelector('svg')
              ? getComputedStyle(host.querySelector('svg')!).display
              : 'no-svg'
        };
      };
      return {
        req: read('requirements.txt'),
        notes: read('notes.txt')
      };
    });
    // The name this project claims keeps its own type and is not sheeted over.
    expect(rows.req.fileType, JSON.stringify(rows)).toBe(
      'vscode-file-type-python'
    );
    expect(rows.req.txtSheet, JSON.stringify(rows)).toBe(false);
    expect(rows.req.svgHidden, JSON.stringify(rows)).not.toBe('none');
    // A .txt this project does not claim still gets the sheet.
    expect(rows.notes.txtSheet, JSON.stringify(rows)).toBe(true);

    // The tab resolves through the registry, and it was the row that
    // disagreed with it, so both are read.
    await page.filebrowser.open(`${tmpPath}/requirements.txt`);
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('.lm-TabBar-tabIcon')].some(h =>
          h.hasAttribute('data-vscode-tab-icon')
        ),
      undefined,
      { timeout: 30000 }
    );
    const tab = await page.evaluate(() => {
      const found = [
        ...document.querySelectorAll(
          '.lm-TabBar-tab[data-type="document-title"]'
        )
      ].find(t => {
        const label = t.querySelector('.lm-TabBar-tabLabel');
        return !!label && label.textContent === 'requirements.txt';
      });
      const host = found ? found.querySelector('.lm-TabBar-tabIcon') : null;
      return host ? host.getAttribute('data-vscode-tab-icon') : 'no-host';
    });
    expect(tab).toBe('registry:vscode-file-type-python');
  });

  // The documented exception to the rule above. jupyterlab_camunda_modeller_
  // extension registers .bpmn with a rounded-square icon and wins the registry,
  // so the camunda svg is what the row renders - the mark is painted over it
  // through the ::before the data-vscode-bpmn attribute drives. The maintainer's
  // instruction, verbatim: "we use ours".
  test("the bpmn row takes this extension's mark", async ({
    page,
    tmpPath
  }) => {
    await page.contents.uploadContent('x', 'text', `${tmpPath}/flow.bpmn`);
    await page.filebrowser.openDirectory(tmpPath);
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('.jp-DirListing-item')].some(r =>
          r.hasAttribute('data-vscode-bpmn')
        ),
      undefined,
      { timeout: 30000 }
    );
    await settleIcons(page);
    const row = await page.evaluate(() => {
      const label = [
        ...document.querySelectorAll('.jp-DirListing-itemText')
      ].find(n => n.textContent!.trim() === 'flow.bpmn');
      const item = label ? label.closest('.jp-DirListing-item') : null;
      const host = item ? item.querySelector('.jp-DirListing-itemIcon') : null;
      const svg = host ? host.querySelector('svg') : null;
      return {
        marked: item ? item.hasAttribute('data-vscode-bpmn') : false,
        fileType: item ? item.getAttribute('data-file-type') : 'no-item',
        registryIcon: svg ? svg.getAttribute('data-icon') : 'no-svg',
        // The mark itself, and the proof the camunda svg under it is hidden.
        before: host
          ? getComputedStyle(host, '::before').backgroundImage
          : 'no-host',
        svgHidden: svg ? getComputedStyle(svg).display : 'no-svg'
      };
    });
    expect(row.marked, JSON.stringify(row)).toBe(true);
    // A background-image, not `none`: the ::before is carrying the mark.
    expect(row.before.startsWith('url('), JSON.stringify(row)).toBe(true);
    expect(row.svgHidden, JSON.stringify(row)).toBe('none');
    // On this workstation camunda owns the registry entry, and its icon is the
    // one being overridden. Where it is absent this extension's own
    // vscode-bpmn type supplies the same mark and there is nothing to hide, so
    // only the override above is asserted unconditionally.
    if (row.fileType === 'bpmn') {
      expect(row.registryIcon).toBe('bpmn:icon');
    }
  });
});
