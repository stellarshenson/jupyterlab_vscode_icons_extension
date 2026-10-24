import { expect, galata, test } from '@jupyterlab/galata';

/**
 * Main-area tabs with no icon of their own, and the Settings Editor entry.
 *
 * JupyterLab reserves the icon slot on every tab, so an icon-less tab showed
 * its label indented. The slot collapses unless collapseEmptyTabIcons is off.
 * A page that shows a web page in an iframe gets a globe instead: brand colour
 * when the lab or a loopback host serves it, accent colour for another site.
 */

const PLUGIN = 'jupyterlab_vscode_icons_extension:plugin';

const addPage = (page: any, label: string, src: string | null): Promise<void> =>
  page.evaluate(
    ([title, url]: [string, string | null]) => {
      const app = (window as any).jupyterapp;
      // Galata exposes no widget classes; LabShell extends Lumino's Widget.
      const Widget = Object.getPrototypeOf(
        app.shell.constructor.prototype
      ).constructor;
      const widget = new Widget();
      widget.id = `page-${title.replace(/\W/g, '-')}`;
      widget.title.label = title;
      widget.title.closable = true;
      if (url) {
        const frame = document.createElement('iframe');
        frame.src = url;
        widget.node.appendChild(frame);
      }
      app.shell.add(widget, 'main');
    },
    [label, src]
  );

const readTab = (page: any, label: string): Promise<any> =>
  page.evaluate((title: string) => {
    const tab = [
      ...document.querySelectorAll<HTMLElement>(
        '.lm-DockPanel-tabBar .lm-TabBar-tab'
      )
    ].find(
      t => t.querySelector('.lm-TabBar-tabLabel')?.textContent?.trim() === title
    );
    const host = tab?.querySelector<HTMLElement>('.lm-TabBar-tabIcon');
    const text = tab?.querySelector<HTMLElement>('.lm-TabBar-tabLabel');
    const ring = host?.querySelector('circle');
    return {
      found: !!tab,
      display: host ? getComputedStyle(host).display : null,
      width: host ? host.getBoundingClientRect().width : null,
      icon: host?.querySelector('svg[data-icon]')?.getAttribute('data-icon'),
      stroke: ring ? getComputedStyle(ring).stroke : null,
      labelOffset:
        tab && text
          ? text.getBoundingClientRect().left -
            tab.getBoundingClientRect().left -
            parseFloat(getComputedStyle(tab).paddingLeft) -
            parseFloat(getComputedStyle(tab).borderLeftWidth)
          : null
    };
  }, label);

const cssColour = (page: any, variable: string): Promise<string> =>
  page.evaluate((name: string) => {
    const probe = document.createElement('div');
    probe.style.color = `var(${name})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, variable);

test.describe('tab with no icon', () => {
  test('collapses the empty icon slot so the label starts at the edge', async ({
    page
  }) => {
    await addPage(page, 'Plain page', null);
    await expect
      .poll(async () => (await readTab(page, 'Plain page')).found)
      .toBe(true);
    const tab = await readTab(page, 'Plain page');

    expect(tab.icon ?? null).toBeNull();
    expect(tab.display).toBe('none');
    expect(Math.abs(tab.labelOffset)).toBeLessThan(1);
  });
});

test.describe('tab with no icon, setting off', () => {
  test.use({
    mockSettings: {
      ...galata.DEFAULT_SETTINGS,
      [PLUGIN]: { collapseEmptyTabIcons: false }
    }
  });

  test('keeps JupyterLab icon slot when collapseEmptyTabIcons is off', async ({
    page
  }) => {
    await page.waitForFunction(() =>
      document.body.hasAttribute('data-vscode-keep-empty-tab-icon')
    );
    await addPage(page, 'Plain page', null);
    await expect
      .poll(async () => (await readTab(page, 'Plain page')).found)
      .toBe(true);
    const tab = await readTab(page, 'Plain page');

    // The shell's jp-Icon class makes the reserved box 16px, plus 4px margin.
    expect(tab.display).not.toBe('none');
    expect(tab.width).toBe(16);
    expect(tab.labelOffset).toBeGreaterThanOrEqual(19);
  });
});

test.describe('iframe page tabs', () => {
  test('shows the brand globe on a proxied local page', async ({ page }) => {
    await addPage(page, 'Local service', '/proxy/1/');
    await expect
      .poll(async () => (await readTab(page, 'Local service')).icon)
      .toBe('jupyterlab_vscode_icons_extension:local-page');
    const tab = await readTab(page, 'Local service');

    expect(tab.stroke).toBe(await cssColour(page, '--jp-brand-color1'));
    expect(tab.display).not.toBe('none');
  });

  test('shows the accent globe on a remote page', async ({ page }) => {
    await addPage(page, 'Remote site', 'https://example.invalid/');
    await expect
      .poll(async () => (await readTab(page, 'Remote site')).icon)
      .toBe('jupyterlab_vscode_icons_extension:remote-page');
    const tab = await readTab(page, 'Remote site');

    expect(tab.stroke).toBe(await cssColour(page, '--jp-accent-color1'));
  });

  // DEF-TABS-80: the globe arriving on the debounced pass moved the label
  // 20px after the first paint. Set at shell.add, it is there before Lumino
  // renders the tab, and the shell then adds no 16px jp-Icon box either.
  test('sets the globe as the shell adds the page', async ({ page }) => {
    await page.waitForFunction(
      () => !!document.getElementById('vscode-icons-jupytext-override')
    );
    const name = await page.evaluate(() => {
      const app = (window as any).jupyterapp;
      const Widget = Object.getPrototypeOf(
        app.shell.constructor.prototype
      ).constructor;
      const widget = new Widget();
      widget.id = 'page-at-add';
      widget.title.label = 'Page at add';
      widget.title.closable = true;
      const frame = document.createElement('iframe');
      frame.src = '/proxy/1/';
      widget.node.appendChild(frame);
      app.shell.add(widget, 'main');
      return widget.title.icon ? widget.title.icon.name : null;
    });
    expect(name).toBe('jupyterlab_vscode_icons_extension:local-page');

    await expect
      .poll(async () => (await readTab(page, 'Page at add')).icon)
      .toBe('jupyterlab_vscode_icons_extension:local-page');
    const tab = await readTab(page, 'Page at add');
    expect(tab.width).toBe(14);
    expect(tab.labelOffset).toBe(18);
  });
});

test.describe('Settings Editor', () => {
  test('shows this extension icon on its settings entry', async ({ page }) => {
    await page.evaluate(async () => {
      await (window as any).jupyterapp.commands.execute('settingeditor:open');
    });
    const icon = await page.waitForFunction(
      () => {
        const entry = [
          ...document.querySelectorAll('.jp-PluginList-entry')
        ].find(e => e.textContent?.includes('VSCode Icons'));
        // An unregistered name resolves to a loading placeholder that carries
        // the same data-icon, so the VS Code logo's fill is what proves the
        // artwork arrived.
        const svg = entry?.querySelector('svg[data-icon]');
        return svg && svg.innerHTML.includes('#007acc')
          ? svg.getAttribute('data-icon')
          : null;
      },
      null,
      { timeout: 30000 }
    );

    expect(await icon.jsonValue()).toBe(
      'jupyterlab_vscode_icons_extension:settings'
    );
  });
});
