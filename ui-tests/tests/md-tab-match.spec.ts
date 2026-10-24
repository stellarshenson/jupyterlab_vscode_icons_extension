import { expect, test } from '@jupyterlab/galata';

/**
 * DEF-TABS-79 regression tests.
 *
 * A document tab whose icon slot carries one of JupyterLab's generic glyphs
 * must show the same JupyterLab icon as its file browser row, for every type
 * JupyterLab claims. The mirror travels through widget.title.icon, so the tab
 * keeps the icon's jp-icon-contrast class and its rendered fill matches the
 * row. Files the extension itself claims keep the old painter, and the
 * default markdown viewer tab is untouched.
 */

const FILENAMES = [
  'notes.md',
  'notes.py',
  'notes.rs',
  'README.md',
  'notes.xyz123'
];

const CONTENT: Record<string, string> = {
  'notes.md': '# Notes\n\nmd-tab-match fixture\n',
  'notes.py': 'print("md-tab-match")\n',
  'notes.rs': 'fn main() {\n    println!("md-tab-match");\n}\n',
  'README.md': '# Readme\n\nmd-tab-match fixture\n',
  'notes.xyz123': 'md-tab-match fixture\n'
};

const uploadFixtures = async (page: any, tmpPath: string): Promise<void> => {
  for (const name of FILENAMES) {
    await page.contents.uploadContent(
      CONTENT[name],
      'text',
      `${tmpPath}/${name}`
    );
  }
  await page.filebrowser.openDirectory(tmpPath);
  await page.waitForFunction(
    (names: string[]) => {
      const present = [
        ...document.querySelectorAll('.jp-DirListing-itemText')
      ].map(n => n.textContent?.trim());
      return names.every(n => present.includes(n));
    },
    FILENAMES,
    { timeout: 30000 }
  );
  // The row painter runs on its own observer; let it settle before reading.
  await page.waitForTimeout(1500);
};

const openEditor = async (page: any, fullPath: string): Promise<void> => {
  await page.evaluate(async (target: string) => {
    await (window as any).jupyterapp.commands.execute('docmanager:open', {
      path: target,
      factory: 'Editor'
    });
  }, fullPath);
};

const waitForState = async (
  page: any,
  name: string,
  dataIcon: string,
  marker: string | null
): Promise<void> => {
  await page.waitForFunction(
    (args: { name: string; dataIcon: string; marker: string | null }) => {
      const tabs = [
        ...document.querySelectorAll(
          '.lm-TabBar-tab[data-type="document-title"]'
        )
      ].filter(
        t =>
          t.querySelector('.lm-TabBar-tabLabel')?.textContent?.trim() ===
          args.name
      );
      return tabs.some(tab => {
        const host = tab.querySelector('.lm-TabBar-tabIcon');
        const svg = host?.querySelector('svg[data-icon]');
        return (
          svg?.getAttribute('data-icon') === args.dataIcon &&
          (host?.getAttribute('data-vscode-tab-icon') ?? null) === args.marker
        );
      });
    },
    { name, dataIcon, marker },
    { timeout: 30000 }
  );
  // markTabIcons debounces 100 ms; allow Lumino's own re-render as well.
  await page.waitForTimeout(500);
};

// Opening a file selects its row, and JupyterLab paints a selected row icon
// white (ui-components/style/icons.css:252). The comparable rendered colour is
// the unselected row's, read before the open.
const collectRowFill = async (
  page: any,
  name: string
): Promise<string | null> =>
  page.evaluate((target: string) => {
    const row = [
      ...document.querySelectorAll<HTMLElement>('.jp-DirListing-item')
    ].find(
      item =>
        item.querySelector('.jp-DirListing-itemText')?.textContent?.trim() ===
        target
    );
    const icon = row?.querySelector('.jp-DirListing-itemIcon svg[data-icon]');
    const shape = icon?.querySelector(
      'path,circle,rect,text,polygon,polyline,ellipse,line'
    );
    return shape ? getComputedStyle(shape).fill : null;
  }, name);

const collectPair = async (page: any, name: string): Promise<any> =>
  page.evaluate((target: string) => {
    const shapes = (svg: Element | null): Element[] =>
      svg
        ? [
            ...svg.querySelectorAll(
              'path,circle,rect,text,polygon,polyline,ellipse,line'
            )
          ]
        : [];
    const contrastClass = (svg: Element | null): boolean =>
      !!svg &&
      [svg, ...svg.querySelectorAll('*')].some(el =>
        [...el.classList].some(c => c.startsWith('jp-icon-contrast'))
      );
    const ds = (svg: Element | null): string[] =>
      svg
        ? [...svg.querySelectorAll('path')]
            .map(p => p.getAttribute('d') || '')
            .filter(d => !!d)
        : [];
    const row =
      [...document.querySelectorAll<HTMLElement>('.jp-DirListing-item')].find(
        item =>
          item.querySelector('.jp-DirListing-itemText')?.textContent?.trim() ===
          target
      ) ?? null;
    const rowIcon =
      row?.querySelector('.jp-DirListing-itemIcon svg[data-icon]') ?? null;
    const rowShape = shapes(rowIcon)[0] ?? null;
    const tabs = [
      ...document.querySelectorAll<HTMLElement>(
        '.lm-TabBar-tab[data-type="document-title"]'
      )
    ].filter(
      tab =>
        tab.querySelector('.lm-TabBar-tabLabel')?.textContent?.trim() === target
    );
    const tab = tabs[tabs.length - 1] ?? null;
    const host = tab?.querySelector<HTMLElement>('.lm-TabBar-tabIcon') ?? null;
    const tabIcon = host?.querySelector('svg[data-icon]') ?? null;
    const tabShape = shapes(tabIcon)[0] ?? null;
    return {
      row: {
        found: !!row,
        dataIcon: rowIcon ? rowIcon.getAttribute('data-icon') : null,
        fill: rowShape ? getComputedStyle(rowShape).fill : null,
        contrastClass: contrastClass(rowIcon),
        ds: ds(rowIcon)
      },
      tab: {
        found: !!tab,
        dataIcon: tabIcon ? tabIcon.getAttribute('data-icon') : null,
        painted: host ? host.getAttribute('data-vscode-tab-icon') : null,
        fill: tabShape ? getComputedStyle(tabShape).fill : null,
        contrastClass: contrastClass(tabIcon),
        background: host ? host.style.backgroundImage : '',
        ds: ds(tabIcon)
      }
    };
  }, name);

const decodePaint = async (
  page: any,
  background: string
): Promise<{ ds: string[]; fills: string[] }> =>
  page.evaluate((css: string) => {
    const quoted = /^url\("(.*)"\)$/s.exec(css) || /^url\('(.*)'\)$/s.exec(css);
    const inner = quoted ? quoted[1] : css;
    if (!inner.startsWith('data:image/svg+xml;utf8,')) {
      return { ds: [], fills: [] };
    }
    const svg = decodeURIComponent(
      inner.slice('data:image/svg+xml;utf8,'.length)
    );
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const paths = [...parsed.querySelectorAll('path')];
    return {
      ds: paths.map(p => p.getAttribute('d') || '').filter(d => !!d),
      fills: paths.map(p => p.getAttribute('fill') || '').filter(f => !!f)
    };
  }, background);

test.use({ deviceScaleFactor: 2 });

test.describe('DEF-TABS-79: document tab matches its file browser row', () => {
  test('shows JupyterLab markdown on a .md editor tab, matching its row', async ({
    page,
    tmpPath
  }) => {
    await uploadFixtures(page, tmpPath);
    const rowFill = await collectRowFill(page, 'notes.md');
    await openEditor(page, `${tmpPath}/notes.md`);
    await waitForState(page, 'notes.md', 'ui-components:markdown', null);
    const pair = await collectPair(page, 'notes.md');

    expect(pair.row.dataIcon).toBe('ui-components:markdown');
    expect(pair.tab.dataIcon).toBe('ui-components:markdown');
    expect(pair.tab.painted).toBeNull();
    expect(pair.tab.background).toBe('');
    expect(pair.tab.fill).toBe(rowFill);
    expect(pair.tab.contrastClass).toBe(true);
    expect(pair.row.contrastClass).toBe(true);
  });

  test('shows JupyterLab python on a .py editor tab, matching its row', async ({
    page,
    tmpPath
  }) => {
    await uploadFixtures(page, tmpPath);
    const rowFill = await collectRowFill(page, 'notes.py');
    await openEditor(page, `${tmpPath}/notes.py`);
    await waitForState(page, 'notes.py', 'ui-components:python', null);
    const pair = await collectPair(page, 'notes.py');

    expect(pair.row.dataIcon).toBe('ui-components:python');
    expect(pair.tab.dataIcon).toBe('ui-components:python');
    expect(pair.tab.painted).toBeNull();
    expect(pair.tab.background).toBe('');
    expect(pair.tab.fill).toBe(rowFill);
  });

  test('shows the generic file icon on an unknown file editor tab, matching its row', async ({
    page,
    tmpPath
  }) => {
    await uploadFixtures(page, tmpPath);
    const rowFill = await collectRowFill(page, 'notes.xyz123');
    await openEditor(page, `${tmpPath}/notes.xyz123`);
    await waitForState(page, 'notes.xyz123', 'ui-components:file', null);
    const pair = await collectPair(page, 'notes.xyz123');

    expect(pair.row.dataIcon).toBe('ui-components:file');
    expect(pair.tab.dataIcon).toBe('ui-components:file');
    expect(pair.tab.painted).toBeNull();
    expect(pair.tab.fill).toBe(rowFill);
  });

  test('keeps the bundled artwork on a .rs editor tab, matching its row', async ({
    page,
    tmpPath
  }) => {
    await uploadFixtures(page, tmpPath);
    await openEditor(page, `${tmpPath}/notes.rs`);
    await waitForState(
      page,
      'notes.rs',
      'ui-components:text-editor',
      'registry:vscode-file-type-rust-hexagon'
    );
    const pair = await collectPair(page, 'notes.rs');
    const decoded = await decodePaint(page, pair.tab.background);

    expect(pair.row.dataIcon).toBe('vscode-icons:file-type-rust-hexagon');
    expect(pair.tab.dataIcon).toBe('ui-components:text-editor');
    expect(pair.tab.painted).toBe('registry:vscode-file-type-rust-hexagon');
    expect(pair.tab.background).toContain('data:image/svg+xml');
    expect(decoded.ds.length).toBeGreaterThan(0);
    expect(decoded.ds).toEqual(pair.row.ds);
  });

  test('leaves the default .md viewer tab on JupyterLab markdown', async ({
    page,
    tmpPath
  }) => {
    await uploadFixtures(page, tmpPath);
    const rowFill = await collectRowFill(page, 'notes.md');
    await page.filebrowser.open(`${tmpPath}/notes.md`);
    await waitForState(page, 'notes.md', 'ui-components:markdown', null);
    const pair = await collectPair(page, 'notes.md');

    expect(pair.row.dataIcon).toBe('ui-components:markdown');
    expect(pair.tab.dataIcon).toBe('ui-components:markdown');
    expect(pair.tab.painted).toBeNull();
    expect(pair.tab.background).toBe('');
    expect(pair.tab.fill).toBe(rowFill);
  });

  test('shows the README icon on a README.md viewer tab, matching its row', async ({
    page,
    tmpPath
  }) => {
    await uploadFixtures(page, tmpPath);
    await page.filebrowser.open(`${tmpPath}/README.md`);
    await waitForState(
      page,
      'README.md',
      'ui-components:markdown',
      'registry:vscode-readme'
    );
    const pair = await collectPair(page, 'README.md');

    expect(pair.row.dataIcon).toBe('readme-icon');
    expect(pair.tab.painted).toBe('registry:vscode-readme');
    expect(pair.tab.background).toContain('data:image/svg+xml');
  });
});
