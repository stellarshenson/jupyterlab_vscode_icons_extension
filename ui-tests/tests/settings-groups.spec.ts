import { expect, galata, test } from '@jupyterlab/galata';

/**
 * Settings groups - ACC-CONFIG-6 and DEF-CONFIG-18.
 *
 * Each of the seven `enable*Icons` settings owns a family of file types. With a
 * group switched off, this extension must not register or paint the icons in
 * that family, and JupyterLab's own icon must come through instead - a row is
 * never left blank. Galata's `mockSettings` fixture supplies the user settings
 * before the lab loads, so the toggles are exercised end to end rather than
 * read back out of the schema.
 */

const PLUGIN = 'jupyterlab_vscode_icons_extension:plugin';

const ALL_OFF = {
  enableLanguageIcons: false,
  enableWebIcons: false,
  enableDataIcons: false,
  enableConfigIcons: false,
  enableDocIcons: false,
  enableImageIcons: false,
  enableExecutableIcons: false
};

type RowState = {
  found: boolean;
  fileType: string | null;
  icon: string | null;
  painted: string | null;
  drawn: boolean;
  before: string;
  overrides: string[];
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
    const svg = host ? host.querySelector('svg') : null;
    const box = host ? host.getBoundingClientRect() : null;
    return {
      found: !!item,
      fileType: item ? item.getAttribute('data-file-type') : null,
      icon: svg ? svg.getAttribute('data-icon') : null,
      painted: host ? host.getAttribute('data-vscode-row-icon') : null,
      drawn: !!box && box.width > 0 && box.height > 0,
      // The name-based overrides paint on ::before, not on the host, so a row
      // read that ignores the pseudo-element cannot see them at all.
      before: host
        ? getComputedStyle(host, '::before').backgroundImage
        : 'no-host',
      overrides: item
        ? item
            .getAttributeNames()
            .filter(
              a =>
                a.startsWith('data-vscode-') ||
                a === 'data-uv-lock' ||
                a === 'data-pytest' ||
                a === 'data-readme-md' ||
                a === 'data-claude-md' ||
                a.startsWith('data-jupytext-')
            )
        : []
    };
  }, name);

// A row is painted from a debounced pass, and JupyterLab re-renders rows, so a
// paint that is expected is waited for rather than read once.
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

// An absence is asserted after the one-second bootstrap pass has had its turn,
// so `not painted` cannot mean `not painted yet`.
const settleAbsence = (page: any): Promise<void> => page.waitForTimeout(1500);

const openWith = async (
  page: any,
  tmpPath: string,
  names: string[]
): Promise<void> => {
  for (const name of names) {
    await page.contents.uploadContent('x', 'text', `${tmpPath}/${name}`);
  }
  // A `src` directory is the signal that the extension's pass has run on this
  // listing: markSpecialFiles stamps data-src-folder on it, and the folder
  // attributes are the ones no settings group owns, so the signal survives
  // every toggle being off. It used to be a marker .pdf, which stopped working
  // the moment the name-based overrides started honouring the toggles
  // (DEF-CONFIG-22). Waiting on a fixed timeout instead made every assertion
  // here pass on the slow run and fail on the fast one.
  await page.contents.uploadContent('x', 'text', `${tmpPath}/src/keep`);
  await page.filebrowser.openDirectory(tmpPath);
  await page.waitForFunction(
    (last: string) =>
      [...document.querySelectorAll('.jp-DirListing-itemText')].some(
        n => n.textContent!.trim() === last
      ),
    names[names.length - 1],
    { timeout: 30000 }
  );
  await page.waitForFunction(
    () => {
      const label = [
        ...document.querySelectorAll('.jp-DirListing-itemText')
      ].find(n => n.textContent!.trim() === 'src');
      const item = label ? label.closest('.jp-DirListing-item') : null;
      return !!item && item.hasAttribute('data-src-folder');
    },
    undefined,
    { timeout: 30000 }
  );
  await page.evaluate(
    () =>
      new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
};

test.describe('one group switched off', () => {
  // Only the language group is off here. The web row in the same listing is
  // the control: it proves the extension activated and still paints under a
  // mocked settings file, so the language assertions below mean something.
  test.use({
    mockSettings: {
      ...galata.DEFAULT_SETTINGS,
      [PLUGIN]: { enableLanguageIcons: false }
    }
  });

  test('a language row is left to JupyterLab', async ({ page, tmpPath }) => {
    await openWith(page, tmpPath, ['sample.js', 'sample.vue']);
    await settleAbsence(page);
    const control = await readRow(page, 'sample.vue');
    expect(control.fileType, JSON.stringify(control)).toBe(
      'vscode-file-type-vue'
    );
    const row = await readRow(page, 'sample.js');
    expect(row.found, JSON.stringify(row)).toBe(true);
    // ACC-CONFIG-6, registration half: the file type is not registered
    // while the group is off.
    expect(row.fileType, JSON.stringify(row)).not.toBe(
      'vscode-file-type-js-official'
    );
    // ACC-CONFIG-6: and the fallback painter does not put it back.
    expect(row.painted, JSON.stringify(row)).toBeNull();
    // The row still shows something - JupyterLab's own glyph.
    expect(row.drawn, JSON.stringify(row)).toBe(true);
    expect(row.icon, JSON.stringify(row)).not.toBeNull();
  });

  test('a family no file type claims keeps its glyph', async ({
    page,
    tmpPath
  }) => {
    // The documented limit of DEF-CONFIG-18's fix: `.log` belongs to no
    // group, so one group off does not reach it. Only every group off does.
    await openWith(page, tmpPath, ['trace.log']);
    await waitPainted(page, 'trace.log');
    const row = await readRow(page, 'trace.log');
    expect(row.painted, JSON.stringify(row)).toBe('file-type-log');
  });
});

test.describe('language group off reaches the hand registrations', () => {
  test.use({
    mockSettings: {
      ...galata.DEFAULT_SETTINGS,
      [PLUGIN]: { enableLanguageIcons: false }
    }
  });

  test('a shell script and a batch file go bare', async ({ page, tmpPath }) => {
    // DEF-CONFIG-26: shell and batch are registered by hand, so fileTypeConfigs
    // had no row for them, groupFor returned no group, and the fallback painter
    // treated the family as ungoverned - the .bat row even took the unix shell
    // glyph. notes.txt is the control: the doc group is still on here, so its
    // override must still be painted, which is what makes the two assertions
    // below mean the toggle worked rather than the extension being dead.
    await openWith(page, tmpPath, ['deploy.sh', 'run.bat', 'notes.txt']);
    await settleAbsence(page);
    for (const name of ['deploy.sh', 'run.bat']) {
      const row = await readRow(page, name);
      expect(row.painted, `${name} ${JSON.stringify(row)}`).toBeNull();
      expect(row.fileType, `${name} ${JSON.stringify(row)}`).not.toContain(
        'vscode-'
      );
      expect(row.drawn, `${name} ${JSON.stringify(row)}`).toBe(true);
    }
    const control = await readRow(page, 'notes.txt');
    expect(control.before, JSON.stringify(control)).toContain('url(');
  });
});

test.describe('doc group off reaches the hand registrations', () => {
  test.use({
    mockSettings: {
      ...galata.DEFAULT_SETTINGS,
      [PLUGIN]: { enableDocIcons: false }
    }
  });

  test('LICENSE goes bare while a language file keeps its icon', async ({
    page,
    tmpPath
  }) => {
    // The same defect for the doc group. sample.vue is the control: the
    // language group is on here, so it must still resolve to this extension's
    // file type.
    await openWith(page, tmpPath, ['LICENSE', 'sample.vue']);
    await settleAbsence(page);
    const licence = await readRow(page, 'LICENSE');
    expect(licence.painted, JSON.stringify(licence)).toBeNull();
    expect(licence.fileType, JSON.stringify(licence)).not.toContain('vscode-');
    expect(licence.drawn, JSON.stringify(licence)).toBe(true);
    const control = await readRow(page, 'sample.vue');
    expect(control.fileType, JSON.stringify(control)).toBe(
      'vscode-file-type-vue'
    );
  });

  test('a PDF tab keeps JupyterLab artwork', async ({ page, tmpPath }) => {
    await page.contents.uploadContent('x', 'text', `${tmpPath}/tabbed.pdf`);
    await page.filebrowser.openDirectory(tmpPath);
    await page.filebrowser.open(`${tmpPath}/tabbed.pdf`);
    await page.waitForTimeout(1500);
    const icons = await page.evaluate(() => {
      const tab = [...document.querySelectorAll('.lm-TabBar-tab')].find(
        item =>
          item.querySelector('.lm-TabBar-tabLabel')?.textContent ===
          'tabbed.pdf'
      );
      const host = tab?.querySelector('.lm-TabBar-tabIcon');
      return {
        painted: host?.getAttribute('data-vscode-tab-icon'),
        owner: host?.querySelector('svg')?.getAttribute('data-icon')
      };
    });
    expect(icons.painted, JSON.stringify(icons)).toBeNull();
    expect(icons.owner, JSON.stringify(icons)).toBe('ui-components:pdf');
  });
});

test.describe('every group switched off', () => {
  test.use({
    mockSettings: { ...galata.DEFAULT_SETTINGS, [PLUGIN]: { ...ALL_OFF } }
  });

  test('the name-based overrides are off too', async ({ page, tmpPath }) => {
    // DEF-CONFIG-22: these five paint through ::before from markSpecialFiles,
    // which read no settings at all - with every group off they kept this
    // extension's artwork and hid JupyterLab's glyph underneath it. Each one
    // must now carry no override attribute, no ::before artwork, and still
    // draw something.
    const names = ['notes.txt', 'a.pdf', 'logo.svg', 'uv.lock', 'conftest.py'];
    await openWith(page, tmpPath, names);
    await settleAbsence(page);
    for (const name of names) {
      const row = await readRow(page, name);
      expect(row.found, `${name} ${JSON.stringify(row)}`).toBe(true);
      expect(row.overrides, `${name} ${JSON.stringify(row)}`).toEqual([]);
      expect(row.before, `${name} ${JSON.stringify(row)}`).toBe('none');
      expect(row.painted, `${name} ${JSON.stringify(row)}`).toBeNull();
      expect(row.drawn, `${name} ${JSON.stringify(row)}`).toBe(true);
    }
  });

  test('a custom registration is off too', async ({ page, tmpPath }) => {
    // The same defect's other half: LICENSE, CHANGELOG.md and README.md were
    // registered with this extension's icons regardless of the toggles.
    // Makefile is deliberately not in this list: another extension on this
    // workstation owns that name, so the assertion could not fail here.
    await openWith(page, tmpPath, ['LICENSE', 'CHANGELOG.md', 'README.md']);
    await settleAbsence(page);
    for (const name of ['LICENSE', 'CHANGELOG.md', 'README.md']) {
      const row = await readRow(page, name);
      expect(row.fileType, `${name} ${JSON.stringify(row)}`).not.toContain(
        'vscode-'
      );
      // The registration being skipped is only half of it - the fallback
      // painter must not put a bundled glyph in its place either.
      expect(row.painted, `${name} ${JSON.stringify(row)}`).toBeNull();
      expect(row.before, `${name} ${JSON.stringify(row)}`).toBe('none');
      expect(row.drawn, `${name} ${JSON.stringify(row)}`).toBe(true);
    }
  });

  test('no row carries a painted glyph', async ({ page, tmpPath }) => {
    // DEF-CONFIG-18: `.log` and `.jar` are in the bundled icon map but no
    // fileTypeConfigs entry claims them, so groupFor returns no group for
    // them. The gate must not read a missing group as permission to paint.
    await openWith(page, tmpPath, ['trace.log', 'lib.jar', 'sample.js']);
    // The same listing read under default settings is the control for this
    // block: `a painted row has a box the background can fill` in
    // file-browser-icons.spec.ts paints trace.log with every group on, so a
    // bare row here is the toggle working, not a dead extension.
    await settleAbsence(page);
    const rows = await Promise.all(
      ['trace.log', 'lib.jar', 'sample.js'].map(name => readRow(page, name))
    );
    for (const row of rows) {
      expect(row.painted, JSON.stringify(row)).toBeNull();
      expect(row.drawn, JSON.stringify(row)).toBe(true);
    }
  });
});

test.describe('a group off reaches every painting path', () => {
  test.use({
    mockSettings: {
      ...galata.DEFAULT_SETTINGS,
      [PLUGIN]: { enableConfigIcons: false, enableLanguageIcons: false }
    }
  });

  test('hand artwork obeys the toggle on a tab', async ({ page, tmpPath }) => {
    // resolveIcon consults the hand artwork before it computes the group, so
    // a toggled-off family could still paint its artwork on a tab while its
    // row goes bare. uv.lock belongs to the config group.
    await page.contents.uploadContent('x', 'text', `${tmpPath}/uv.lock`);
    await page.filebrowser.openDirectory(tmpPath);
    await page.filebrowser.open(`${tmpPath}/uv.lock`);
    await page.waitForTimeout(2500);
    const tab = await page.evaluate(() => {
      const found = [
        ...document.querySelectorAll(
          '.lm-TabBar-tab[data-type="document-title"]'
        )
      ].find(t => {
        const label = t.querySelector('.lm-TabBar-tabLabel');
        return !!label && label.textContent === 'uv.lock';
      });
      const host = found
        ? (found.querySelector('.lm-TabBar-tabIcon') as HTMLElement | null)
        : null;
      return {
        found: !!found,
        painted: host ? host.getAttribute('data-vscode-tab-icon') : 'no-host'
      };
    });
    expect(tab.found, JSON.stringify(tab)).toBe(true);
    expect(tab.painted, JSON.stringify(tab)).toBeNull();
  });

  test('a family registered outside the table obeys its toggle', async ({
    page,
    tmpPath
  }) => {
    // The shell glyph is registered by hand, outside fileTypeConfigs, so
    // groupFor cannot name its group. With the language group off the
    // registration is skipped - and the bundled glyph must not be painted in
    // its place, which would swap the icon rather than remove it.
    await openWith(page, tmpPath, ['deploy.sh']);
    await settleAbsence(page);
    const row = await readRow(page, 'deploy.sh');
    expect(row.found, JSON.stringify(row)).toBe(true);
    expect(row.painted, JSON.stringify(row)).toBeNull();
    expect(row.drawn, JSON.stringify(row)).toBe(true);
  });
});
