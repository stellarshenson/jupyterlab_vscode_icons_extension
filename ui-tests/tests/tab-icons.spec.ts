import { expect, galata, test } from '@jupyterlab/galata';

/**
 * Document tab icons - ACC-TABS-27, ACC-TABS-28, ACC-TABS-32 and ACC-TABS-34.
 *
 * JupyterLab puts its own editor glyph on a file editor tab, so a registered
 * file type's icon never arrives there. The extension paints the icon on the
 * tab's icon host and records which one in `data-vscode-tab-icon`. The tab must
 * mirror the file browser row, so the row's `data-file-type` is the expected
 * value rather than a hardcoded icon name.
 */

const openAndRead = async (
  page: any,
  tmpPath: string,
  name: string
): Promise<{ tabIcon: string | null; rowFileType: string | null }> => {
  await page.filebrowser.open(`${tmpPath}/${name}`);
  await page.waitForTimeout(1500);
  return page.evaluate((fileName: string) => {
    const rows: Record<string, string> = {};
    document.querySelectorAll('.jp-DirListing-item').forEach(row => {
      const label = row.querySelector('.jp-DirListing-itemText');
      if (label && label.textContent) {
        rows[label.textContent.trim()] =
          row.getAttribute('data-file-type') || '';
      }
    });
    const tab = [
      ...document.querySelectorAll('.lm-TabBar-tab[data-type="document-title"]')
    ].find(t => {
      const label = t.querySelector('.lm-TabBar-tabLabel');
      return !!label && label.textContent === fileName;
    });
    const host = tab ? tab.querySelector('.lm-TabBar-tabIcon') : null;
    return {
      tabIcon: host ? host.getAttribute('data-vscode-tab-icon') : null,
      rowFileType: rows[fileName] ?? null
    };
  }, name);
};

test.describe('document tab icons', () => {
  // Galata gives each test file its own directory on the server and the file
  // browser opens it; uploading to the server root would land outside the view.
  test.beforeEach(async ({ page, tmpPath }) => {
    await page.contents.uploadContent('x', 'text', `${tmpPath}/tabbed.js`);
    await page.contents.uploadContent('x', 'text', `${tmpPath}/tabbed.qqzz`);
    await page.filebrowser.openDirectory(tmpPath);
  });

  test('a tab mirrors its file browser row', async ({ page, tmpPath }) => {
    const { tabIcon, rowFileType } = await openAndRead(
      page,
      tmpPath,
      'tabbed.js'
    );
    expect(rowFileType).toBe('vscode-file-type-js-official');
    // ACC-TABS-27: the tab resolves through the registry, like the row does.
    expect(tabIcon).toBe(`registry:${rowFileType}`);
  });

  test('a tab never shows an empty icon', async ({ page, tmpPath }) => {
    // ACC-TABS-34: the slot is never empty. The icon may be this extension's,
    // another extension's, or JupyterLab's own - what must not happen is
    // nothing, so the assertion reads the rendered result, not the marker.
    await openAndRead(page, tmpPath, 'tabbed.qqzz');
    const painted = await page.evaluate(() => {
      const tab = [
        ...document.querySelectorAll(
          '.lm-TabBar-tab[data-type="document-title"]'
        )
      ].find(t => {
        const label = t.querySelector('.lm-TabBar-tabLabel');
        return !!label && label.textContent === 'tabbed.qqzz';
      });
      const host = tab
        ? (tab.querySelector('.lm-TabBar-tabIcon') as any)
        : null;
      if (!host) {
        return { background: 'none', svg: 0 };
      }
      const svg = host.querySelector('svg');
      const svgBox = svg ? (svg as any).getBoundingClientRect() : null;
      const style = getComputedStyle(host);
      const hostBox = host.getBoundingClientRect();
      return {
        background: style.backgroundImage,
        svgArea: svgBox ? Math.round(svgBox.width * svgBox.height) : 0,
        hostArea: Math.round(hostBox.width * hostBox.height),
        drawn:
          (!!svg && svgBox!.width > 0 && svgBox!.height > 0) ||
          (style.backgroundImage !== 'none' &&
            hostBox.width > 0 &&
            hostBox.height > 0)
      };
    });
    // A background or an svg is true in any state the pass reached, so the
    // check is the rendered size of what is actually drawn: an svg box, or a
    // background on a host the stylesheet has given a height.
    expect(painted.drawn, JSON.stringify(painted)).toBe(true);
  });

  test('a tab keeps the icon another extension registered', async ({
    page,
    tmpPath
  }) => {
    // ACC-TABS-31: .tf resolves to the `terraform` type that
    // jupyterlab_terraform_file_type_extension registers, measured ahead of
    // this project's own vscode-file-type-terraform. The tab painter must hand
    // that icon through rather than paint its own bundled glyph over it. The
    // subject used to be .bpmn, which no longer tests the rule: the
    // maintainer's instruction, verbatim "we use ours", makes .bpmn a
    // deliberate exception, proven by `the bpmn tab takes this extension's
    // mark` below.
    await page.contents.uploadContent(
      'resource "null_resource" "x" {}',
      'text',
      `${tmpPath}/owned.tf`
    );
    await page.filebrowser.openDirectory(tmpPath);
    await page.filebrowser.open(`${tmpPath}/owned.tf`);
    await page.waitForTimeout(2500);
    const tab = await page.evaluate(() => {
      const found = [
        ...document.querySelectorAll(
          '.lm-TabBar-tab[data-type="document-title"]'
        )
      ].find(t => {
        const label = t.querySelector('.lm-TabBar-tabLabel');
        return !!label && label.textContent === 'owned.tf';
      });
      const host = found
        ? (found.querySelector('.lm-TabBar-tabIcon') as HTMLElement | null)
        : null;
      const svg = host ? host.querySelector('svg') : null;
      return {
        found: !!found,
        painted: host ? host.getAttribute('data-vscode-tab-icon') : 'no-host',
        icon: svg ? svg.getAttribute('data-icon') : 'no-svg'
      };
    });
    expect(tab.found, JSON.stringify(tab)).toBe(true);
    // The rule under test needs a competing claim to respect, and only this
    // workstation has one: CI installs jupyterlab plus this project's wheel,
    // where this extension's own vscode-file-type-terraform wins and there is
    // nothing to defer to. Measured there, the tab carries
    // `registry:vscode-file-type-terraform` and the assertions below would
    // fail on a correct build - the same trade the row level sibling in
    // file-browser-icons.spec.ts already makes.
    test.skip(
      tab.painted === 'registry:vscode-file-type-terraform',
      'no third-party terraform provider installed in this environment'
    );
    // What must not appear is one of this extension's own keys: the icon on the
    // tab comes from the registry and belongs to the other extension.
    const painted = tab.painted || '';
    expect(painted.startsWith('registry:'), JSON.stringify(tab)).toBe(true);
    expect(
      painted.startsWith('registry:vscode-') ||
        painted.startsWith('file-type-'),
      JSON.stringify(tab)
    ).toBe(false);
  });

  // The documented exception to the rule above: .bpmn is painted with this
  // extension's own artwork even though camunda's icon is specific and
  // registered. The maintainer's instruction, verbatim: "we use ours".
  test("the bpmn tab takes this extension's mark", async ({
    page,
    tmpPath
  }) => {
    await page.contents.uploadContent(
      '<?xml version="1.0"?><definitions/>',
      'text',
      `${tmpPath}/owned.bpmn`
    );
    await page.filebrowser.openDirectory(tmpPath);
    await page.filebrowser.open(`${tmpPath}/owned.bpmn`);
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('.lm-TabBar-tabIcon')].some(
          h => h.getAttribute('data-vscode-tab-icon') === 'artwork:bpmn'
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
        return !!label && label.textContent === 'owned.bpmn';
      });
      const host = found
        ? (found.querySelector('.lm-TabBar-tabIcon') as HTMLElement | null)
        : null;
      return {
        painted: host ? host.getAttribute('data-vscode-tab-icon') : 'no-host',
        bg: host ? host.style.backgroundImage : 'no-host'
      };
    });
    // `artwork:bpmn` is the rowArtwork key, so the tab is reading the same
    // constant the row paints rather than camunda's registry entry.
    expect(tab.painted, JSON.stringify(tab)).toBe('artwork:bpmn');
    // This extension's tile, not camunda's: camunda draws #fc5d0d with a
    // 19.528 corner radius in its tile path, and this one is #fd7430 on a
    // plain rectangle. Both are asserted, so neither a recolour back nor a
    // fall-through to camunda's artwork can pass.
    const bg = decodeURIComponent(tab.bg);
    expect(bg.includes('#fd7430'), bg.slice(0, 200)).toBe(true);
    expect(bg.includes('19.528'), bg.slice(0, 200)).toBe(false);
    expect(bg.includes('#fc5d0d'), bg.slice(0, 200)).toBe(false);
  });

  test('a tab that is not a document is left alone', async ({ page }) => {
    // ACC-TABS-32: only data-type="document-title" tabs are touched, so the
    // Launcher - which carries no such marker - keeps whatever icon it has.
    const marked = await page.evaluate(
      () =>
        [...document.querySelectorAll('.lm-TabBar-tab')]
          .filter(t => (t as HTMLElement).dataset.type !== 'document-title')
          .filter(t => {
            const host = t.querySelector('.lm-TabBar-tabIcon');
            return !!host && host.hasAttribute('data-vscode-tab-icon');
          }).length
    );
    expect(marked).toBe(0);
  });
});

test.describe('painted tab glyph box', () => {
  // DEF-TABS-33-1. JupyterLab sizes the icon host at 14px while rendering its
  // own tab icons at their intrinsic 16px, so a painted tab sat 2px short of a
  // stock one. The maintainer asked for the box to be padded rather than the
  // glyph scaled: 16px of box, the glyph still drawn at lab's 14px and centred,
  // and 2px of gutter so the label does not move from lab's 14+4.
  test('is padded to 16px with the glyph left at 14px', async ({
    page,
    tmpPath
  }) => {
    await page.contents.uploadContent('x', 'text', `${tmpPath}/padded.js`);
    await page.filebrowser.openDirectory(tmpPath);
    await page.filebrowser.open(`${tmpPath}/padded.js`);
    await page.waitForFunction(
      () => {
        const tab = [
          ...document.querySelectorAll(
            '.lm-TabBar-tab[data-type="document-title"]'
          )
        ].find(t => {
          const label = t.querySelector('.lm-TabBar-tabLabel');
          return !!label && label.textContent === 'padded.js';
        });
        const host = tab ? tab.querySelector('.lm-TabBar-tabIcon') : null;
        return !!host && host.hasAttribute('data-vscode-tab-icon');
      },
      undefined,
      { timeout: 30000 }
    );
    const box = await page.evaluate(() => {
      const tab = [
        ...document.querySelectorAll(
          '.lm-TabBar-tab[data-type="document-title"]'
        )
      ].find(t => {
        const label = t.querySelector('.lm-TabBar-tabLabel');
        return !!label && label.textContent === 'padded.js';
      });
      const host = tab!.querySelector('.lm-TabBar-tabIcon') as HTMLElement;
      const style = getComputedStyle(host);
      const rect = host.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        backgroundSize: style.backgroundSize,
        backgroundPosition: style.backgroundPosition,
        marginRight: style.marginRight
      };
    });
    expect(box.width, JSON.stringify(box)).toBe(16);
    expect(box.height, JSON.stringify(box)).toBe(16);
    // The glyph is not scaled: lab's 14px stands.
    expect(box.backgroundSize.startsWith('14px'), JSON.stringify(box)).toBe(
      true
    );
    expect(box.marginRight, JSON.stringify(box)).toBe('2px');
  });
});

test.describe('a renamed open file', () => {
  // The tab half of the same mechanism: Lumino rewrites the tab label in
  // place and the file editor keeps its stock icon whatever the path, so a
  // childList-only observer never re-marked the tab after a rename.
  test('its tab takes the icon of the new name', async ({ page, tmpPath }) => {
    await page.contents.uploadContent('x', 'text', `${tmpPath}/open.js`);
    await page.filebrowser.openDirectory(tmpPath);
    await page.filebrowser.open(`${tmpPath}/open.js`);
    await page.waitForTimeout(2000);
    const read = (name: string) =>
      page.evaluate((fileName: string) => {
        const tab = [
          ...document.querySelectorAll(
            '.lm-TabBar-tab[data-type="document-title"]'
          )
        ].find(t => {
          const label = t.querySelector('.lm-TabBar-tabLabel');
          return !!label && label.textContent === fileName;
        });
        const host = tab ? tab.querySelector('.lm-TabBar-tabIcon') : null;
        return {
          found: !!tab,
          painted: host ? host.getAttribute('data-vscode-tab-icon') : 'no-host'
        };
      }, name);

    const before = await read('open.js');
    expect(before.painted, JSON.stringify(before)).toBe(
      'registry:vscode-file-type-js-official'
    );

    await page.contents.renameFile(`${tmpPath}/open.js`, `${tmpPath}/open.vue`);
    await page.waitForFunction(
      () =>
        [
          ...document.querySelectorAll(
            '.lm-TabBar-tab[data-type="document-title"] .lm-TabBar-tabLabel'
          )
        ].some(n => n.textContent === 'open.vue'),
      undefined,
      { timeout: 30000 }
    );
    await page.waitForFunction(
      () => {
        const tab = [
          ...document.querySelectorAll(
            '.lm-TabBar-tab[data-type="document-title"]'
          )
        ].find(t => {
          const label = t.querySelector('.lm-TabBar-tabLabel');
          return !!label && label.textContent === 'open.vue';
        });
        const host = tab ? tab.querySelector('.lm-TabBar-tabIcon') : null;
        return (
          !!host &&
          host.getAttribute('data-vscode-tab-icon') ===
            'registry:vscode-file-type-vue'
        );
      },
      undefined,
      { timeout: 30000 }
    );
    const after = await read('open.vue');
    expect(after.painted, JSON.stringify(after)).toBe(
      'registry:vscode-file-type-vue'
    );
  });
});

test.describe('group toggles reach the tab', () => {
  // ACC-TABS-30: the toggle that stops a file browser row must stop the tab
  // too, or the two disagree for the same file. With the language group off,
  // the .js file type is never registered and the tab painter's own gate
  // refuses the bundled glyph, so the tab keeps JupyterLab's editor icon.
  test.use({
    mockSettings: {
      ...galata.DEFAULT_SETTINGS,
      'jupyterlab_vscode_icons_extension:plugin': {
        enableLanguageIcons: false
      }
    }
  });

  test('a language tab keeps the stock icon', async ({ page, tmpPath }) => {
    await page.contents.uploadContent('x', 'text', `${tmpPath}/toggled.js`);
    await page.filebrowser.openDirectory(tmpPath);
    await page.filebrowser.open(`${tmpPath}/toggled.js`);
    await page.waitForTimeout(2000);
    const tab = await page.evaluate(() => {
      const found = [
        ...document.querySelectorAll(
          '.lm-TabBar-tab[data-type="document-title"]'
        )
      ].find(t => {
        const label = t.querySelector('.lm-TabBar-tabLabel');
        return !!label && label.textContent === 'toggled.js';
      });
      const host = found
        ? (found.querySelector('.lm-TabBar-tabIcon') as HTMLElement | null)
        : null;
      const svg = host ? host.querySelector('svg') : null;
      const box = svg ? svg.getBoundingClientRect() : null;
      return {
        found: !!found,
        painted: host ? host.getAttribute('data-vscode-tab-icon') : 'no-host',
        icon: svg ? svg.getAttribute('data-icon') : 'no-svg',
        drawn: !!box && box.width > 0 && box.height > 0
      };
    });
    expect(tab.found, JSON.stringify(tab)).toBe(true);
    expect(tab.painted, JSON.stringify(tab)).toBeNull();
    // ACC-TABS-34 still holds with the group off: something is on the tab.
    expect(tab.drawn, JSON.stringify(tab)).toBe(true);
  });
});

test.describe('painted tab glyphs stay visible', () => {
  // DEF-COLOUR-32: the vendor artwork was drawn for VSCode's dark sidebar, and
  // some of it has no perceivable contrast on a JupyterLab tab bar - measured
  // in this lab, the yaml wordmark's best pixel is 1.20:1 against a white tab.
  // The painter measures the artwork against the tab it is about to sit on and
  // marks the ones that cannot clear 3:1, which the stylesheet then outlines;
  // measured with the outline, the same glyph reads 19.69:1.
  test('a low-contrast glyph is marked and a legible one is not', async ({
    page,
    tmpPath
  }) => {
    await page.contents.uploadContent('a: 1\n', 'text', `${tmpPath}/probe.yml`);
    await page.contents.uploadContent('x', 'text', `${tmpPath}/probe.jar`);
    await page.filebrowser.openDirectory(tmpPath);
    for (const name of ['probe.yml', 'probe.jar']) {
      await page.filebrowser.open(`${tmpPath}/${name}`);
      await page.waitForTimeout(1200);
    }
    await page.waitForTimeout(1500);
    const tabs = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          '.lm-TabBar-tab[data-type="document-title"]'
        )
      ].map(tab => {
        const label = tab.querySelector('.lm-TabBar-tabLabel');
        const host = tab.querySelector('.lm-TabBar-tabIcon') as HTMLElement;
        return {
          name: label ? label.textContent : null,
          painted: host ? host.getAttribute('data-vscode-tab-icon') : null,
          outlined: host ? host.hasAttribute('data-vscode-tab-outline') : null
        };
      })
    );
    const yaml = tabs.find(t => t.name === 'probe.yml');
    const jar = tabs.find(t => t.name === 'probe.jar');
    expect(yaml, JSON.stringify(tabs)).toBeDefined();
    expect(yaml!.painted, JSON.stringify(tabs)).toBe('file-type-yaml');
    // 1.20:1 on a white tab, so it must be marked.
    expect(yaml!.outlined, JSON.stringify(tabs)).toBe(true);
    // The jar glyph clears the bar on its own, so marking it would be noise.
    expect(jar!.painted, JSON.stringify(tabs)).toBe('file-type-jar');
    expect(jar!.outlined, JSON.stringify(tabs)).toBe(false);
  });
});

test.describe('the outline follows the theme', () => {
  // DEF-COLOUR-32 again: the decision used to be taken once per icon key, so a
  // tab painted on the dark theme kept no outline after a switch to the light
  // one, where the same artwork measures 1.06:1. It is now decided on every
  // pass, and any tab open, close or activation fires one.
  test('a glyph legible on dark gets its edge after a switch to light', async ({
    page,
    tmpPath
  }) => {
    await page.theme.setDarkTheme();
    await page.contents.uploadContent('a: 1\n', 'text', `${tmpPath}/probe.yml`);
    await page.contents.uploadContent('x', 'text', `${tmpPath}/other.jar`);
    await page.filebrowser.openDirectory(tmpPath);
    await page.filebrowser.open(`${tmpPath}/probe.yml`);
    await page.waitForTimeout(2000);

    const read = () =>
      page.evaluate(() => {
        const tab = [
          ...document.querySelectorAll(
            '.lm-TabBar-tab[data-type="document-title"]'
          )
        ].find(t => {
          const l = t.querySelector('.lm-TabBar-tabLabel');
          return !!l && l.textContent === 'probe.yml';
        });
        const host = tab
          ? (tab.querySelector('.lm-TabBar-tabIcon') as HTMLElement)
          : null;
        return {
          painted: host ? host.getAttribute('data-vscode-tab-icon') : null,
          outlined: host ? host.hasAttribute('data-vscode-tab-outline') : null
        };
      });

    const onDark = await read();
    expect(onDark.painted, JSON.stringify(onDark)).toBe('file-type-yaml');
    // 13:1 against the dark bar, so no edge is wanted there.
    expect(onDark.outlined, JSON.stringify(onDark)).toBe(false);

    await page.theme.setLightTheme();
    // A theme switch mutates no tab node, so the next pass is what re-decides:
    // opening another file fires one, which is the journey a user takes.
    await page.filebrowser.open(`${tmpPath}/other.jar`);
    await page.waitForTimeout(2000);
    const onLight = await read();
    expect(onLight.painted, JSON.stringify(onLight)).toBe('file-type-yaml');
    expect(onLight.outlined, JSON.stringify(onLight)).toBe(true);
  });
});
