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

  test('a PDF tab uses the file browser artwork', async ({ page, tmpPath }) => {
    await page.contents.uploadContent('x', 'text', `${tmpPath}/tabbed.pdf`);
    await page.filebrowser.openDirectory(tmpPath);
    const { tabIcon } = await openAndRead(page, tmpPath, 'tabbed.pdf');
    const rowPainted = await page.evaluate(() => {
      const row = [...document.querySelectorAll('.jp-DirListing-item')].find(
        item =>
          item.querySelector('.jp-DirListing-itemText')?.textContent?.trim() ===
          'tabbed.pdf'
      );
      return row?.hasAttribute('data-vscode-pdf') ?? false;
    });
    expect(rowPainted).toBe(true);
    expect(tabIcon).toBe('artwork:pdf');
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
  // DEF-TABS-78 / ACC-TABS-53. JupyterLab sizes the icon host at 14px while
  // rendering its own tab icons at their intrinsic 16px, so a painted tab sat
  // 2px short of a stock one (DEF-TABS-33-1). The host is one 16px border box
  // with 1.5px of padding, leaving a 13x13 content box; the artwork is painted
  // into that box with `contain`, so every aspect ratio fits and nothing is
  // clipped.
  test('keeps one 13px content box inside a 16px host', async ({
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
        contentWidth: Math.round(
          rect.width -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight)
        ),
        contentHeight: Math.round(
          rect.height -
            parseFloat(style.paddingTop) -
            parseFloat(style.paddingBottom)
        ),
        boxSizing: style.boxSizing,
        padding: style.padding,
        backgroundSize: style.backgroundSize,
        backgroundOrigin: style.backgroundOrigin,
        backgroundPosition: style.backgroundPosition,
        backgroundRepeat: style.backgroundRepeat,
        marginRight: style.marginRight
      };
    });
    expect(box.width, JSON.stringify(box)).toBe(16);
    expect(box.height, JSON.stringify(box)).toBe(16);
    expect(box.contentWidth, JSON.stringify(box)).toBe(13);
    expect(box.contentHeight, JSON.stringify(box)).toBe(13);
    expect(box.boxSizing, JSON.stringify(box)).toBe('border-box');
    expect(box.padding, JSON.stringify(box)).toBe('1.5px');
    expect(box.backgroundSize, JSON.stringify(box)).toBe('contain');
    expect(box.backgroundOrigin, JSON.stringify(box)).toBe('content-box');
    expect(box.backgroundPosition, JSON.stringify(box)).toBe('50% 50%');
    expect(box.backgroundRepeat, JSON.stringify(box)).toBe('no-repeat');
    expect(box.marginRight, JSON.stringify(box)).toBe('2px');
  });

  // DEF-TABS-78: the Makefile artwork is portrait, and the old
  // `background-size: 14px auto` drew it about 18.1px high inside a 16px box,
  // clipping the top and bottom. The content box is now 13x13 and the computed
  // size is `contain`, so the fitted image box must fit inside it. The runtime
  // artwork's viewBox is tight, so its long side lands on the content-box edge;
  // the guarantee is that no part extends past that edge, which the old
  // fixed-width size violates.
  test('fits the portrait Makefile inside the content box', async ({
    page,
    tmpPath
  }) => {
    await page.contents.uploadContent(
      'all:\n\techo hi\n',
      'text',
      `${tmpPath}/Makefile`
    );
    await page.filebrowser.openDirectory(tmpPath);
    await page.filebrowser.open(`${tmpPath}/Makefile`);
    await page.waitForFunction(
      () => {
        const tab = [
          ...document.querySelectorAll(
            '.lm-TabBar-tab[data-type="document-title"]'
          )
        ].find(t => {
          const label = t.querySelector('.lm-TabBar-tabLabel');
          return !!label && label.textContent === 'Makefile';
        });
        const host = tab ? tab.querySelector('.lm-TabBar-tabIcon') : null;
        return !!host && !!host.getAttribute('data-vscode-tab-icon');
      },
      undefined,
      { timeout: 30000 }
    );
    const fit = await page.evaluate(() => {
      const tab = [
        ...document.querySelectorAll(
          '.lm-TabBar-tab[data-type="document-title"]'
        )
      ].find(t => {
        const label = t.querySelector('.lm-TabBar-tabLabel');
        return !!label && label.textContent === 'Makefile';
      });
      const host = tab!.querySelector('.lm-TabBar-tabIcon') as HTMLElement;
      const style = getComputedStyle(host);
      const rect = host.getBoundingClientRect();
      const contentWidth =
        rect.width -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      const contentHeight =
        rect.height -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom);
      const uri = style.backgroundImage
        .replace(/^url\("?/, '')
        .replace(/"?\)$/, '');
      const svg = decodeURIComponent(uri.replace(/^data:[^,]*,/, ''));
      const viewBox = (svg.match(/viewBox="([^"]+)"/) || [])[1] || '';
      const vw = Number(viewBox.split(/\s+/)[2]);
      const vh = Number(viewBox.split(/\s+/)[3]);
      const size = style.backgroundSize;
      let drawWidth: number;
      let drawHeight: number;
      if (size === 'contain') {
        const scale = Math.min(contentWidth / vw, contentHeight / vh);
        drawWidth = vw * scale;
        drawHeight = vh * scale;
      } else {
        // Any fixed width keeps the intrinsic ratio for the auto axis; the old
        // stylesheet computed this as `14px auto`.
        drawWidth = parseFloat(size);
        drawHeight = (drawWidth * vh) / vw;
      }
      return {
        contentWidth,
        contentHeight,
        viewBox,
        backgroundSize: size,
        drawWidth,
        drawHeight
      };
    });
    expect(Math.round(fit.contentWidth), JSON.stringify(fit)).toBe(13);
    expect(Math.round(fit.contentHeight), JSON.stringify(fit)).toBe(13);
    expect(fit.viewBox, JSON.stringify(fit)).toBeTruthy();
    expect(fit.backgroundSize, JSON.stringify(fit)).toBe('contain');
    // Portrait: the fitted height fills the box and side margins remain. No
    // part of the image box may extend past the content box, so the old
    // 14px-wide, auto-high fit (18.1px tall in a 16px box) cannot satisfy this.
    expect(fit.drawHeight, JSON.stringify(fit)).toBeLessThanOrEqual(
      fit.contentHeight
    );
    expect(fit.drawWidth, JSON.stringify(fit)).toBeLessThanOrEqual(
      fit.contentWidth
    );
    expect(fit.drawWidth, JSON.stringify(fit)).toBeLessThan(fit.drawHeight);
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
  // DEF-COLOUR-32 and DEF-TABS-78: the vendor artwork was drawn for VSCode's
  // dark sidebar, and some of it has no perceivable contrast on a JupyterLab
  // tab bar - measured in this lab, the log glyph's green #00bd02 is 2.54:1
  // against a white tab. The painter measures the artwork against the tab it is
  // about to sit on, and recolours only when the artwork's best colour the
  // measure reads (a stated hex, or the black an unfilled element paints) is
  // below the bar. When any stated colour is below 3:1, one shared mix toward
  // black or white applies to every stated colour it rewrites. The old
  // drop-shadow edge is gone because it filled the transparent cutouts; it
  // remains only for artwork with no rewriteable colour.
  //
  // The fixture is .log rather than .yml since DEF-TABS-79: a .yml tab now
  // mirrors its row's JupyterLab icon and carries no painted glyph.
  test('a low-contrast glyph is recoloured and a legible one is not', async ({
    page,
    tmpPath
  }) => {
    await page.contents.uploadContent('a: 1\n', 'text', `${tmpPath}/probe.log`);
    await page.contents.uploadContent('x', 'text', `${tmpPath}/probe.jar`);
    await page.filebrowser.openDirectory(tmpPath);
    for (const name of ['probe.log', 'probe.jar']) {
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
          variant: host ? host.getAttribute('data-vscode-tab-variant') : null,
          outlined: host ? host.hasAttribute('data-vscode-tab-outline') : null,
          filter: host ? getComputedStyle(host).filter : null
        };
      })
    );
    const log = tabs.find(t => t.name === 'probe.log');
    const jar = tabs.find(t => t.name === 'probe.jar');
    expect(log, JSON.stringify(tabs)).toBeDefined();
    expect(log!.painted, JSON.stringify(tabs)).toBe('file-type-log');
    // 2.54:1 on a white tab, so its stated fill is rewritten. The variant
    // carries the measured background after the colon.
    expect(log!.variant?.startsWith('contrast'), JSON.stringify(tabs)).toBe(
      true
    );
    expect(log!.filter, JSON.stringify(tabs)).toBe('none');
    expect(log!.outlined, JSON.stringify(tabs)).toBe(false);
    // The jar glyph clears the bar on its own and keeps the original fill.
    expect(jar!.painted, JSON.stringify(tabs)).toBe('file-type-jar');
    expect(jar!.variant, JSON.stringify(tabs)).toBe('');
    expect(jar!.outlined, JSON.stringify(tabs)).toBe(false);
    // No stated-colour tab falls back to the outline: the recolour covers them
    // all.
    const outlined = await page.evaluate(
      () => document.querySelectorAll('[data-vscode-tab-outline]').length
    );
    expect(outlined, JSON.stringify(tabs)).toBe(0);
  });
});

test.describe('the contrast variant follows the theme', () => {
  // DEF-COLOUR-32 again: the decision used to be taken once per icon key, so a
  // tab painted on the dark theme kept its original fill after a switch to the
  // light one, where the same artwork measures 2.54:1. The painter now
  // recolours on every pass and the guard watches the variant, so any tab
  // open, close or activation that fires one is enough.
  test('a glyph repainted for the light theme replaces the original fill', async ({
    page,
    tmpPath
  }) => {
    await page.theme.setDarkTheme();
    await page.contents.uploadContent('a: 1\n', 'text', `${tmpPath}/probe.log`);
    await page.filebrowser.openDirectory(tmpPath);
    await page.filebrowser.open(`${tmpPath}/probe.log`);
    await page.waitForTimeout(2000);

    const read = () =>
      page.evaluate(() => {
        const tab = [
          ...document.querySelectorAll(
            '.lm-TabBar-tab[data-type="document-title"]'
          )
        ].find(t => {
          const l = t.querySelector('.lm-TabBar-tabLabel');
          return !!l && l.textContent === 'probe.log';
        });
        const host = tab
          ? (tab.querySelector('.lm-TabBar-tabIcon') as HTMLElement)
          : null;
        return {
          painted: host ? host.getAttribute('data-vscode-tab-icon') : null,
          variant: host ? host.getAttribute('data-vscode-tab-variant') : null,
          outlined: host ? host.hasAttribute('data-vscode-tab-outline') : null,
          background: host ? host.style.backgroundImage : null
        };
      });

    const onDark = await read();
    expect(onDark.painted, JSON.stringify(onDark)).toBe('file-type-log');
    // 6.35:1 against the dark bar, so the original fill is kept.
    expect(onDark.variant, JSON.stringify(onDark)).toBe('');
    expect(onDark.outlined, JSON.stringify(onDark)).toBe(false);

    await page.theme.setLightTheme();
    // The theme switch mutates the body attributes the observer watches and
    // calls markTabIcons; the tab node itself need not mutate.
    await page.waitForTimeout(2000);
    const onLight = await read();
    expect(onLight.painted, JSON.stringify(onLight)).toBe('file-type-log');
    expect(
      onLight.variant?.startsWith('contrast'),
      JSON.stringify(onLight)
    ).toBe(true);
    expect(onLight.outlined, JSON.stringify(onLight)).toBe(false);
    // The recoloured data URI must have replaced the original one: this is the
    // regression for the guard that ignored the variant.
    expect(onLight.background, JSON.stringify(onLight)).not.toBe(
      onDark.background
    );
  });
});

/** The WCAG relative luminance of an sRGB colour, channels in 0-255. */
const relativeLuminance = (channels: [number, number, number]): number => {
  const linear = channels.map(value => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

/** The three channels of an `rgb(...)` string or a `#rgb`/`#rrggbb` value. */
const channelsOf = (value: string): [number, number, number] => {
  const rgb = value.match(/rgba?\(([^)]+)\)/);
  if (rgb) {
    const parts = rgb[1].split(',').map(part => parseFloat(part));
    return [parts[0], parts[1], parts[2]];
  }
  const hex = value.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!hex) {
    throw new Error(`unreadable colour: ${value}`);
  }
  const full =
    hex[1].length === 3
      ? hex[1]
          .split('')
          .map(c => c + c)
          .join('')
      : hex[1];
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16)
  ];
};

/** The WCAG ratio between two colours. */
const contrastRatio = (a: string, b: string): number => {
  const first = relativeLuminance(channelsOf(a));
  const second = relativeLuminance(channelsOf(b));
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

/** Every hex `fill` carried by a painted `url("data:...")` background. */
const paintedFills = (backgroundImage: string): string[] => {
  const uri = backgroundImage.replace(/^url\("?/, '').replace(/"?\)$/, '');
  const svg = decodeURIComponent(uri.replace(/^data:[^,]*,/, ''));
  const stated = svg.match(/fill="(#[0-9a-fA-F]{3,6})"/g) || [];
  return stated.map(attribute =>
    attribute.replace(/^fill="/, '').replace(/"$/, '')
  );
};

test.describe('a contrast variant follows its background', () => {
  // ACC-TABS-55 / DEF-TABS-78: the guard used to compare only the icon key and
  // a binary 'contrast' marker, so a tab moving between two backgrounds that
  // both need a recolour - the active white tab and the inactive #eeeeee one -
  // returned before repainting and kept the fill measured for the old
  // background. The variant now carries the measured background, so the guard
  // sees the change. The fills are read back from the painted URI and measured
  // against the tab's own computed background; the expected values are not
  // hardcoded.
  test('contrast to contrast repaints for the new background', async ({
    page,
    tmpPath
  }) => {
    await page.theme.setLightTheme();
    await page.contents.uploadContent('a: 1\n', 'text', `${tmpPath}/probe.log`);
    await page.contents.uploadContent('x', 'text', `${tmpPath}/other.jar`);
    await page.filebrowser.openDirectory(tmpPath);
    // The jar is opened first so its tab exists and can be clicked below;
    // probe.log is opened last so it starts active on the white tab.
    await page.filebrowser.open(`${tmpPath}/other.jar`);
    await page.filebrowser.open(`${tmpPath}/probe.log`);
    await page.waitForFunction(
      () => {
        const host = [
          ...document.querySelectorAll(
            '.lm-TabBar-tab[data-type="document-title"]'
          )
        ]
          .filter(tab => {
            const label = tab.querySelector('.lm-TabBar-tabLabel');
            return !!label && label.textContent === 'probe.log';
          })
          .map(tab => tab.querySelector('.lm-TabBar-tabIcon'))[0];
        const variant = host
          ? host.getAttribute('data-vscode-tab-variant') || ''
          : '';
        return variant.startsWith('contrast');
      },
      undefined,
      { timeout: 30000 }
    );

    const read = () =>
      page.evaluate(() => {
        const tab = [
          ...document.querySelectorAll(
            '.lm-TabBar-tab[data-type="document-title"]'
          )
        ].find(t => {
          const label = t.querySelector('.lm-TabBar-tabLabel');
          return !!label && label.textContent === 'probe.log';
        });
        const host = tab
          ? (tab.querySelector('.lm-TabBar-tabIcon') as HTMLElement | null)
          : null;
        return {
          variant: host ? host.getAttribute('data-vscode-tab-variant') : null,
          backgroundImage: host ? host.style.backgroundImage : null,
          background: tab ? getComputedStyle(tab).backgroundColor : null
        };
      });

    const active = await read();
    expect(active.background, JSON.stringify(active)).toBe(
      'rgb(255, 255, 255)'
    );
    expect(active.variant, JSON.stringify(active)).toContain('contrast');
    const activeFills = paintedFills(active.backgroundImage!);
    expect(activeFills.length, JSON.stringify(active)).toBeGreaterThan(0);
    for (const fill of activeFills) {
      expect(
        contrastRatio(fill, active.background!),
        `${fill} on the active background ${active.background}`
      ).toBeGreaterThanOrEqual(3);
    }

    // Clicking the jar tab makes probe.log inactive: the tab keeps its node
    // but takes the #eeeeee background, which needs its own recolour.
    await page
      .locator('.lm-TabBar-tab[data-type="document-title"]')
      .filter({ hasText: 'other.jar' })
      .locator('.lm-TabBar-tabLabel')
      .click();
    await page.waitForFunction(
      (previous: string) => {
        const host = [
          ...document.querySelectorAll(
            '.lm-TabBar-tab[data-type="document-title"]'
          )
        ]
          .filter(tab => {
            const label = tab.querySelector('.lm-TabBar-tabLabel');
            return !!label && label.textContent === 'probe.log';
          })
          .map(tab => tab.querySelector('.lm-TabBar-tabIcon'))[0];
        const variant = host
          ? host.getAttribute('data-vscode-tab-variant')
          : null;
        return (
          !!variant && variant.startsWith('contrast') && variant !== previous
        );
      },
      active.variant,
      { timeout: 30000 }
    );

    const inactive = await read();
    expect(inactive.background, JSON.stringify(inactive)).toBe(
      'rgb(238, 238, 238)'
    );
    expect(inactive.variant, JSON.stringify(inactive)).not.toBe(active.variant);
    expect(inactive.backgroundImage, JSON.stringify(inactive)).not.toBe(
      active.backgroundImage
    );
    const inactiveFills = paintedFills(inactive.backgroundImage!);
    expect(inactiveFills.length, JSON.stringify(inactive)).toBeGreaterThan(0);
    for (const fill of inactiveFills) {
      expect(
        contrastRatio(fill, inactive.background!),
        `${fill} on the inactive background ${inactive.background}`
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
