import { expect, test } from '@jupyterlab/galata';

/**
 * Tab icons across layout changes - ACC-TABS-29.
 *
 * Lumino rebuilds the tab nodes when the bar is reordered and when a widget
 * moves to another dock area, which throws away anything written onto them.
 * The painter has to put the icons back, so the test changes the layout and
 * reads the markers again rather than trusting the first paint.
 */

const FILES = ['one.js', 'two.vue', 'three.ts'];

const markers = (page: any): Promise<Record<string, string | null>> =>
  page.evaluate(() => {
    const out: Record<string, string | null> = {};
    document
      .querySelectorAll('.lm-TabBar-tab[data-type="document-title"]')
      .forEach(tab => {
        const label = tab.querySelector('.lm-TabBar-tabLabel');
        const host = tab.querySelector('.lm-TabBar-tabIcon');
        if (label && label.textContent) {
          out[label.textContent.trim()] = host
            ? host.getAttribute('data-vscode-tab-icon')
            : 'no-host';
        }
      });
    return out;
  });

const waitAllPainted = (page: any): Promise<void> =>
  page.waitForFunction(
    (names: string[]) =>
      names.every(name => {
        const tab = [
          ...document.querySelectorAll(
            '.lm-TabBar-tab[data-type="document-title"]'
          )
        ].find(t => {
          const label = t.querySelector('.lm-TabBar-tabLabel');
          return !!label && label.textContent!.trim() === name;
        });
        const host = tab ? tab.querySelector('.lm-TabBar-tabIcon') : null;
        return !!host && host.hasAttribute('data-vscode-tab-icon');
      }),
    FILES,
    { timeout: 30000 }
  );

test.describe('tab icons across layout changes', () => {
  test.beforeEach(async ({ page, tmpPath }) => {
    for (const name of FILES) {
      await page.contents.uploadContent('x', 'text', `${tmpPath}/${name}`);
    }
    await page.filebrowser.openDirectory(tmpPath);
    for (const name of FILES) {
      await page.filebrowser.open(`${tmpPath}/${name}`);
    }
    await waitAllPainted(page);
  });

  const order = (page: any): Promise<string[]> =>
    page.evaluate(() =>
      [
        ...document.querySelectorAll(
          '.lm-TabBar-tab[data-type="document-title"] .lm-TabBar-tabLabel'
        )
      ].map(n => n.textContent!.trim())
    );

  test('reordering the tab bar keeps every icon', async ({ page }) => {
    const before = await markers(page);
    const orderBefore = await order(page);
    // The reorder goes through the shell rather than a synthetic drag: a
    // Playwright drag over the tab bar left the order untouched, which made
    // the first version of this test pass without moving anything. `tab-before`
    // is the same insertion Lumino performs when a user drops a tab, and it
    // rebuilds the tab nodes the same way.
    await page.evaluate(() => {
      const app = (window as any).jupyterapp;
      const widgets = [...app.shell.widgets('main')];
      app.shell.add(widgets[widgets.length - 1], 'main', {
        mode: 'tab-before',
        ref: widgets[0].id
      });
    });
    await waitAllPainted(page);
    // The drag has to have moved something, or the icons were never retested.
    expect(await order(page)).not.toEqual(orderBefore);
    expect(await markers(page)).toEqual(before);
  });

  test('moving a document to a split area keeps its icon', async ({ page }) => {
    const before = await markers(page);
    await page.evaluate(() => {
      const app = (window as any).jupyterapp;
      const widgets = [...app.shell.widgets('main')];
      const moved = widgets[widgets.length - 1];
      app.shell.add(moved, 'main', {
        mode: 'split-right',
        ref: widgets[0].id
      });
    });
    await waitAllPainted(page);
    const after = await markers(page);
    expect(after).toEqual(before);
    // The split really happened: two tab bars now hold the documents.
    const bars = await page.evaluate(
      () =>
        document.querySelectorAll('#jp-main-dock-panel .lm-DockPanel-tabBar')
          .length
    );
    expect(bars).toBeGreaterThan(1);
  });
});
