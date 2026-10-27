import { expect, test } from '@jupyterlab/galata';

/**
 * Tab tooltip - ACC-TABS-63 to ACC-TABS-69.
 *
 * After 800 ms over a main-area tab a tooltip shows the full label, the file
 * path or page URL, and the last activity as time ago. data-last-activity on
 * the tooltip carries the timestamp the time-ago line was made from, so the
 * activity rules can be checked without waiting minutes.
 */

const LONG = 'a-rather-long-file-name-for-the-tooltip-check.txt';

const tabOf = (page: any, label: string) =>
  page.locator('.lm-DockPanel-tabBar .lm-TabBar-tab', {
    has: page.locator('.lm-TabBar-tabLabel', { hasText: label })
  });

const tooltip = (page: any) => page.locator('.vscode-tab-tooltip');

// Hover the tab until the tooltip shows, read it, then move off the tab.
const readTooltip = async (
  page: any,
  label: string
): Promise<{ lines: string[]; activity: number }> => {
  await tabOf(page, label).hover();
  await expect(tooltip(page)).toBeVisible({ timeout: 3000 });
  const lines = await tooltip(page)
    .locator('.vscode-tab-tooltip-line')
    .allTextContents();
  const activity = Number(
    await tooltip(page).getAttribute('data-last-activity')
  );
  await page.mouse.move(700, 600);
  await expect(tooltip(page)).toHaveCount(0);
  return { lines, activity };
};

// Open a terminal and return its tab label once it is connected; the tab
// reads '...' until then. cwd is relative to the server root, as the launcher
// passes it; without it the shell starts in the server's own directory.
const openTerminal = async (page: any, cwd?: string): Promise<string> => {
  await page.evaluate(async (cwd?: string) => {
    await (window as any).jupyterapp.commands.execute('terminal:create-new', {
      cwd
    });
  }, cwd);
  return (
    await page.waitForFunction(() => {
      const widget = (window as any).jupyterapp.shell.currentWidget;
      return widget?.content?.session?.connectionStatus === 'connected' &&
        widget.title.label !== '...'
        ? widget.title.label
        : null;
    })
  ).jsonValue();
};

test.describe('tab tooltip', () => {
  test.beforeEach(async ({ page, tmpPath }) => {
    await page.contents.uploadContent(
      'first line\n',
      'text',
      `${tmpPath}/${LONG}`
    );
    await page.contents.uploadContent('x = 1\n', 'text', `${tmpPath}/other.py`);
    await page.filebrowser.openDirectory(tmpPath);
    await page.filebrowser.open(`${tmpPath}/${LONG}`);
    await expect(tabOf(page, LONG)).toBeVisible();
  });

  test('shows the full label, the path and the last activity after 800 ms', async ({
    page,
    tmpPath
  }) => {
    const tab = tabOf(page, LONG);
    await tab.hover();
    await page.waitForTimeout(300);
    expect(await tooltip(page).count()).toBe(0);
    await expect(tooltip(page)).toBeVisible({ timeout: 3000 });
    expect(await tab.getAttribute('title')).toBeNull();

    const lines = await tooltip(page)
      .locator('.vscode-tab-tooltip-line')
      .allTextContents();
    expect(lines[0]).toBe(LONG);
    expect(lines[1]).toBe(`${tmpPath}/${LONG}`);
    expect(lines[2]).toMatch(/^Last activity: /);
    // JupyterLab's caption, without its Name and Path lines (ACC-TABS-68).
    expect(lines.slice(3)).toEqual([
      expect.stringMatching(/^Last Saved: /),
      expect.stringMatching(/^Last Checkpoint: /)
    ]);
  });

  test('shows the URL of an iframe page', async ({ page }) => {
    const url = await page.evaluate(() => {
      const app = (window as any).jupyterapp;
      // Galata exposes no widget classes; LabShell extends Lumino's Widget.
      const Widget = Object.getPrototypeOf(
        app.shell.constructor.prototype
      ).constructor;
      const widget = new Widget();
      widget.id = 'tooltip-page';
      widget.title.label = 'Tooltip page';
      widget.title.closable = true;
      const frame = document.createElement('iframe');
      frame.src = '/proxy/1/';
      widget.node.appendChild(frame);
      app.shell.add(widget, 'main');
      return frame.src;
    });
    const { lines } = await readTooltip(page, 'Tooltip page');

    expect(lines[0]).toBe('Tooltip page');
    expect(lines[1]).toBe(url);
  });

  // ACC-TABS-73: the directory shows relative to the server root, and outside
  // the root the line is left out.
  test('shows the working directory of a terminal and follows cd, nested shells too', async ({
    page,
    tmpPath
  }) => {
    await page.contents.createDirectory(`${tmpPath}/outer/inner`);
    const label = await openTerminal(page, tmpPath);
    const secondLine = () =>
      expect.poll(async () => (await readTooltip(page, label)).lines[1], {
        timeout: 15000
      });

    const before = await readTooltip(page, label);
    expect(before.lines[0]).toBe(label);
    expect(before.lines[1]).toBe(tmpPath);

    await page.locator('.jp-Terminal').click();
    await page.keyboard.type('cd outer\n');
    await secondLine().toBe(`${tmpPath}/outer`);

    // DEF-TABS-82: a cd in a nested shell is seen, not only the outer one.
    await page.locator('.jp-Terminal').click();
    await page.keyboard.type('bash --norc\n');
    await page.keyboard.type('cd inner\n');
    await secondLine().toBe(`${tmpPath}/outer/inner`);

    // Outside the root the directory line goes and the activity line moves up.
    await page.locator('.jp-Terminal').click();
    await page.keyboard.type('cd /usr\n');
    await secondLine().toMatch(/^Last activity: /);
  });

  test('a terminal directory that answers after the pointer left shows no tooltip', async ({
    page
  }) => {
    const label = await openTerminal(page);
    let release = (): void => undefined;
    const held = new Promise<void>(resolve => (release = resolve));
    let requested = false;
    await page.route('**/vscode-icons/terminal-cwd/**', async (route: any) => {
      requested = true;
      await held;
      await route.continue();
    });

    await tabOf(page, label).hover();
    await expect.poll(() => requested).toBe(true);
    await page.mouse.move(700, 600);
    release();
    await page.waitForTimeout(1000);

    expect(await tooltip(page).count()).toBe(0);
  });

  test('last activity stays put while idle and follows typing and reopening', async ({
    page,
    tmpPath
  }) => {
    const first = await readTooltip(page, LONG);
    await page.waitForTimeout(1500);
    const idle = await readTooltip(page, LONG);
    expect(idle.activity).toBe(first.activity);

    await page.locator('.jp-FileEditor .cm-content').click();
    await page.keyboard.type('typed text');
    const typed = await readTooltip(page, LONG);
    expect(typed.activity).toBeGreaterThan(idle.activity + 1000);

    await page.filebrowser.open(`${tmpPath}/other.py`);
    await expect(tabOf(page, 'other.py')).toBeVisible();
    await page.waitForTimeout(1500);
    await tabOf(page, LONG).click();
    const reopened = await readTooltip(page, LONG);
    expect(reopened.activity).toBeGreaterThan(typed.activity + 1000);
  });

  test('a right-click hides the tooltip', async ({ page }) => {
    const tab = tabOf(page, LONG);
    await tab.hover();
    await expect(tooltip(page)).toBeVisible({ timeout: 3000 });
    await tab.click({ button: 'right' });

    await expect(tooltip(page)).toHaveCount(0);
    await page.keyboard.press('Escape');
  });

  // A real right-click opens JupyterLab's menu under the pointer, and leaving
  // the tab hides the tooltip on its own. With shiftKey JupyterLab opens no
  // menu (application frontend.js evtContextMenu), so the pointer stays on the
  // tab and only the tooltip's own right-click handling can hide it.
  const shiftRightClick = (page: any, label: string): Promise<void> =>
    page.evaluate((title: string) => {
      const tab = [
        ...document.querySelectorAll('.lm-DockPanel-tabBar .lm-TabBar-tab')
      ].find(
        t =>
          t.querySelector('.lm-TabBar-tabLabel')?.textContent?.trim() === title
      )!;
      const box = tab.getBoundingClientRect();
      const init = {
        bubbles: true,
        cancelable: true,
        button: 2,
        buttons: 2,
        shiftKey: true,
        clientX: box.left + 5,
        clientY: box.top + 5
      };
      tab.dispatchEvent(new MouseEvent('mousedown', init));
      tab.dispatchEvent(new MouseEvent('contextmenu', init));
    }, label);

  test('a right-click hides the tooltip while the pointer stays on the tab', async ({
    page
  }) => {
    await tabOf(page, LONG).hover();
    await expect(tooltip(page)).toBeVisible({ timeout: 3000 });
    await shiftRightClick(page, LONG);

    await expect(tooltip(page)).toHaveCount(0);
  });

  test('a right-click before the delay stops the tooltip', async ({ page }) => {
    await tabOf(page, LONG).hover();
    await shiftRightClick(page, LONG);
    await page.waitForTimeout(1200);

    expect(await tooltip(page).count()).toBe(0);
  });

  test('leaving the tab hides the tooltip and gives back its title', async ({
    page
  }) => {
    const tab = tabOf(page, LONG);
    const title = await tab.getAttribute('title');
    await tab.hover();
    await expect(tooltip(page)).toBeVisible({ timeout: 3000 });
    await page.mouse.move(700, 600);

    await expect(tooltip(page)).toHaveCount(0);
    expect(await tab.getAttribute('title')).toBe(title);
  });

  // DEF-TABS-83: Lumino writes title back when the caption changes.
  test('a caption change while hovered keeps the title held back', async ({
    page
  }) => {
    const tab = tabOf(page, LONG);
    await tab.hover();
    await expect(tooltip(page)).toBeVisible({ timeout: 3000 });
    await page.evaluate((label: string) => {
      const widget = [...(window as any).jupyterapp.shell.widgets('main')].find(
        (candidate: any) => candidate.title.label === label
      );
      widget.title.caption = 'Changed caption';
    }, LONG);
    await page.waitForTimeout(500);

    expect(await tab.getAttribute('title')).toBeNull();
    await page.mouse.move(700, 600);
    await expect(tab).toHaveAttribute('title', 'Changed caption');
  });
});
