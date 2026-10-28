import { expect, galata, test } from '@jupyterlab/galata';
import { createServer, Server } from 'http';
import type { AddressInfo } from 'net';

/**
 * Main-area tabs with no icon of their own, and the Settings Editor entry.
 *
 * JupyterLab reserves the icon slot on every tab, so an icon-less tab showed
 * its label indented. The slot collapses unless collapseEmptyTabIcons is off.
 * A page that shows a web page in an iframe gets a globe instead: brand colour
 * when the lab or a loopback host serves it, accent colour for another site.
 * The globe gives way to the icon the page's server serves once it loads.
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
    const image = host?.querySelector('svg image');
    const box = image?.getBoundingClientRect();
    return {
      found: !!tab,
      favicon: image ? image.getAttribute('href') : null,
      faviconBox: box ? [box.width, box.height] : null,
      // Every element inside the icon svg, by tag and attribute names.
      parts: [...(host?.querySelectorAll('svg *') ?? [])].map(part =>
        [part.tagName, ...part.getAttributeNames().sort()].join(' ')
      ),
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

// The colour at the centre of a tab's icon slot as the screen shows it. The
// screenshot is decoded by the page itself, so no image library is needed.
const centreColour = async (page: any, label: string): Promise<number[]> => {
  const shot: Buffer = await page
    .locator('.lm-DockPanel-tabBar .lm-TabBar-tab', {
      has: page.locator('.lm-TabBar-tabLabel', { hasText: label })
    })
    .locator('.lm-TabBar-tabIcon')
    .screenshot();
  return page.evaluate(async (data: string) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const x = Math.floor(image.width / 2);
    const y = Math.floor(image.height / 2);
    return [...context.getImageData(x, y, 1, 1).data.slice(0, 3)];
  }, shot.toString('base64'));
};

// Solid 16x16 PNGs: red, green and blue.
const RED =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR42mP4z8BAEmIY1TCqYfhqAACQ+f8B8u7oVwAAAABJRU5ErkJggg==';
const GREEN =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFUlEQVR42mNgWMBAGhrVMKph+GoAABFroAG/N8BwAAAAAElFTkSuQmCC';
const BLUE =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFUlEQVR42mNgYPhPIhrVMKph2GoAAJLb/wHQPqPSAAAAAElFTkSuQmCC';
// A 16x16 PNG, transparent except its last pixel, which is opaque red.
const ONE_PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFUlEQVR42mNgGAWjYBSMAgaG/0AEAAkLAf/DzIbQAAAAAElFTkSuQmCC';
// The fully transparent 1x1 GIF pages declare to say they have no favicon.
const BLANK_GIF =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

interface IReply {
  status?: number;
  contentType: string;
  headers?: Record<string, string>;
  body: string | Buffer;
}
const png = (base64: string): IReply => ({
  contentType: 'image/png',
  body: Buffer.from(base64, 'base64')
});
const html = (head = ''): IReply => ({
  contentType: 'text/html',
  body: `<!doctype html><html><head>${head}</head><body>page</body></html>`
});
const NOT_FOUND: IReply = {
  status: 404,
  contentType: 'text/plain',
  body: 'not found'
};

// A web server on a loopback port, so no test leaves this machine. It answers
// each path from `replies`, else with `fallback`, and records it in `seen`.
// A path is read without its query, which a cross-origin reload adds.
// page.route cannot stand in for it: Playwright aborts every routed request
// whose address ends in /favicon.ico.
const servers: Server[] = [];
const startServer = async (
  replies: Record<string, IReply | Promise<IReply>>,
  fallback: IReply = NOT_FOUND
): Promise<{ port: number; seen: string[] }> => {
  const seen: string[] = [];
  const server = createServer(async (request, response) => {
    const path = (request.url ?? '').split('?')[0];
    seen.push(path);
    const reply = (await replies[path]) ?? fallback;
    response.writeHead(reply.status ?? 200, {
      'Content-Type': reply.contentType,
      ...reply.headers
    });
    response.end(reply.body);
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return { port: (server.address() as AddressInfo).port, seen };
};

// A failed favicon changes nothing, so the test waits until the address was
// requested and the answer had time to land, then reads the tab.
const settle = async (seen: string[], address: string, page: any) => {
  await expect.poll(() => seen.includes(address)).toBe(true);
  await page.waitForTimeout(1000);
};

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

// ACC-TABS-74-FAVICON: a web page tab shows the icon the page's server serves,
// and keeps the globe only when none loads. A cross-origin page here is a
// loopback port other than the lab's; a proxied page is that port reached
// through the lab's jupyter-server-proxy at /proxy/<port>/.
test.describe('web page tab favicons', () => {
  // Galata routes the lab's API, and while any route is set Playwright aborts
  // every request for a /favicon.ico, so these tests run unrouted.
  test.beforeEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test.afterEach(() => {
    for (const server of servers.splice(0)) {
      server.closeAllConnections();
      server.close();
    }
  });

  test('swaps the globe for the favicon a cross-origin server serves', async ({
    page
  }) => {
    let release = (): void => undefined;
    const held = new Promise<void>(resolve => (release = resolve));
    const { port } = await startServer({
      '/': html(),
      '/favicon.ico': held.then(() => png(RED))
    });
    const address = `http://127.0.0.1:${port}/favicon.ico`;
    await addPage(page, 'Served icon', `http://127.0.0.1:${port}/`);
    await expect
      .poll(async () => (await readTab(page, 'Served icon')).icon)
      .toBe('jupyterlab_vscode_icons_extension:local-page');
    const globe = await readTab(page, 'Served icon');

    release();
    await expect
      .poll(async () => (await readTab(page, 'Served icon')).favicon)
      .toBe(address);
    const tab = await readTab(page, 'Served icon');

    expect(tab.icon).toBe(
      `jupyterlab_vscode_icons_extension:favicon:${address}`
    );
    // DEF-TABS-80: the swap happens in place, so the label does not move.
    expect(globe.width).toBe(14);
    expect(globe.labelOffset).toBe(18);
    expect(tab.width).toBe(globe.width);
    expect(tab.labelOffset).toBe(globe.labelOffset);
    expect(tab.faviconBox).toEqual([13, 13]);
    expect(await centreColour(page, 'Served icon')).toEqual([255, 0, 0]);
  });

  test('keeps the globe when the favicon is a 404', async ({ page }) => {
    const { port, seen } = await startServer({ '/': html() });
    await addPage(page, 'Missing icon', `http://127.0.0.1:${port}/`);
    await settle(seen, '/favicon.ico', page);
    const tab = await readTab(page, 'Missing icon');

    expect(tab.icon).toBe('jupyterlab_vscode_icons_extension:local-page');
    expect(tab.favicon).toBeNull();
  });

  test('keeps the globe when every path answers with a page', async ({
    page
  }) => {
    const { port, seen } = await startServer({}, html());
    await addPage(page, 'Pages only', `http://127.0.0.1:${port}/`);
    await settle(seen, '/favicon.ico', page);
    const tab = await readTab(page, 'Pages only');

    expect(tab.icon).toBe('jupyterlab_vscode_icons_extension:local-page');
    expect(tab.favicon).toBeNull();
  });

  test('prefers the icon a proxied page declares', async ({ page }) => {
    const { port } = await startServer({
      '/': html('<link rel="icon" href="brand.png">'),
      '/brand.png': png(GREEN),
      '/favicon.ico': png(BLUE)
    });
    const origin = await page.evaluate(() => location.origin);
    await addPage(page, 'Declared icon', `/proxy/${port}/`);
    await expect
      .poll(async () => (await readTab(page, 'Declared icon')).favicon)
      .toBe(`${origin}/proxy/${port}/brand.png`);

    expect(await centreColour(page, 'Declared icon')).toEqual([0, 160, 0]);
  });

  test('uses favicon.ico under the proxy prefix', async ({ page }) => {
    const { port } = await startServer({
      '/': html(),
      '/favicon.ico': png(BLUE)
    });
    const origin = await page.evaluate(() => location.origin);
    await addPage(page, 'Prefix icon', `/proxy/${port}/`);
    await expect
      .poll(async () => (await readTab(page, 'Prefix icon')).favicon)
      .toBe(`${origin}/proxy/${port}/favicon.ico`);

    expect(await centreColour(page, 'Prefix icon')).toEqual([0, 0, 255]);
  });

  // The lab serves its own /favicon.ico, the Jupyter icon.
  test('never puts the lab favicon on a proxied page', async ({ page }) => {
    const { port, seen } = await startServer({ '/': html() });
    await addPage(page, 'No icon', `/proxy/${port}/`);
    await settle(seen, '/favicon.ico', page);
    const tab = await readTab(page, 'No icon');

    expect(tab.icon).toBe('jupyterlab_vscode_icons_extension:local-page');
    expect(tab.favicon).toBeNull();
  });

  // A Jupyter error page under /proxy/<port>/ declares the lab's own icon.
  test('ignores a lab icon a proxied page declares', async ({ page }) => {
    const { port, seen } = await startServer({
      '/': html(
        '<link rel="shortcut icon" href="/static/favicons/favicon.ico">'
      )
    });
    await addPage(page, 'Lab icon', `/proxy/${port}/`);
    await settle(seen, '/favicon.ico', page);
    const tab = await readTab(page, 'Lab icon');

    expect(tab.icon).toBe('jupyterlab_vscode_icons_extension:local-page');
    expect(tab.favicon).toBeNull();
  });

  // DEF-TABS-89: a data: URI names no server, and this server has no
  // favicon.ico, so only the declared icon can replace the globe.
  test('shows a data:image icon a proxied page declares', async ({ page }) => {
    const icon = `data:image/png;base64,${GREEN}`;
    const { port } = await startServer({
      '/': html(`<link rel="icon" href="${icon}">`)
    });
    await addPage(page, 'Data icon', `/proxy/${port}/`);
    await expect
      .poll(async () => (await readTab(page, 'Data icon')).favicon)
      .toBe(icon);

    expect(await centreColour(page, 'Data icon')).toEqual([0, 160, 0]);
  });

  // DEF-TABS-89: Chrome decodes PNG bytes in a data: URI whatever type it
  // names, so only the data:image rule keeps this icon off the tab. An
  // accepted icon would end the search before favicon.ico is requested.
  test('ignores a data: icon of another type a proxied page declares', async ({
    page
  }) => {
    const { port, seen } = await startServer({
      '/': html(`<link rel="icon" href="data:text/html;base64,${GREEN}">`)
    });
    await addPage(page, 'Text data icon', `/proxy/${port}/`);
    await settle(seen, '/favicon.ico', page);
    const tab = await readTab(page, 'Text data icon');

    expect(tab.icon).toBe('jupyterlab_vscode_icons_extension:local-page');
    expect(tab.favicon).toBeNull();
  });

  // DEF-TABS-90: a fully transparent declared icon counts as no icon, so the
  // search goes on to favicon.ico, which this server lacks.
  test('keeps the globe when a proxied page declares a transparent icon', async ({
    page
  }) => {
    const { port, seen } = await startServer({
      '/': html(`<link rel="icon" href="${BLANK_GIF}">`)
    });
    await addPage(page, 'Blank icon', `/proxy/${port}/`);
    await settle(seen, '/favicon.ico', page);
    const tab = await readTab(page, 'Blank icon');

    expect(tab.icon).toBe('jupyterlab_vscode_icons_extension:local-page');
    expect(tab.favicon).toBeNull();
  });

  // DEF-TABS-90: one opaque pixel, the last one read, is enough to show it.
  test('shows a declared data:image icon with one opaque pixel', async ({
    page
  }) => {
    const icon = `data:image/png;base64,${ONE_PIXEL}`;
    const { port } = await startServer({
      '/': html(`<link rel="icon" href="${icon}">`)
    });
    await addPage(page, 'Pixel icon', `/proxy/${port}/`);
    await expect
      .poll(async () => (await readTab(page, 'Pixel icon')).favicon)
      .toBe(icon);
  });

  // DEF-TABS-90: past Chromium's canvas size limit a natural-size read gives
  // all-transparent pixels without throwing; the small scaled read does not.
  test('shows a declared data:image icon larger than the canvas limit', async ({
    page
  }) => {
    const icon =
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20000' height='20000'><rect width='20000' height='20000' fill='red'/></svg>";
    const { port } = await startServer({
      '/': html(`<link rel="icon" href="${icon}">`)
    });
    await addPage(page, 'Large icon', `/proxy/${port}/`);
    await expect
      .poll(async () => (await readTab(page, 'Large icon')).favicon)
      .toBe(icon);
  });

  // DEF-TABS-89: the URL parser leaves the quotes, angle brackets and
  // ampersands of a data: URI raw. Escaped, the address stays one href
  // attribute; unescaped, the second one ends the attribute early and adds
  // handlers that would set window.injected.
  for (const [label, icon] of [
    [
      'Raw svg icon',
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><title>a &amp; b</title><rect width="16" height="16" fill="red"/></svg>'
    ],
    [
      'Break-out icon',
      `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3C!--" onload="window.injected=1" onerror="window.injected=1" data-x="--%3E%3Crect width='16' height='16' fill='red'/%3E%3C/svg%3E`
    ]
  ]) {
    test(`keeps a declared data: URI inside one attribute: ${label}`, async ({
      page
    }) => {
      const attribute = icon.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      const { port } = await startServer({
        '/': html(`<link rel="icon" href="${attribute}">`)
      });
      await addPage(page, label, `/proxy/${port}/`);
      await expect
        .poll(async () => (await readTab(page, label)).favicon)
        .not.toBeNull();
      const tab = await readTab(page, label);

      expect(tab.parts).toEqual(['image height href width x y']);
      expect(tab.favicon).toBe(icon);
      // The screenshot waits for the image to paint, so a load or error
      // handler on it has run before the sentinel is read.
      expect(await centreColour(page, label)).toEqual([255, 0, 0]);
      expect(
        await page.evaluate(() => (window as any).injected)
      ).toBeUndefined();
    });
  }
});

const tabNamed = (page: any, label: string): any =>
  page.locator('.lm-DockPanel-tabBar .lm-TabBar-tab', {
    has: page.locator('.lm-TabBar-tabLabel', { hasText: label })
  });

// The labels of the items the tab's right-click menu shows; a hidden item is
// not listed.
const tabMenu = async (page: any, tab: any): Promise<string[]> => {
  await tab.click({ button: 'right' });
  const items = page.locator('.lm-Menu .lm-Menu-item:visible');
  await expect(items.first()).toBeVisible();
  const labels = await items.locator('.lm-Menu-itemLabel').allTextContents();
  await page.keyboard.press('Escape');
  await expect(page.locator('.lm-Menu')).toHaveCount(0);
  return labels;
};

const reloadPage = async (page: any, label: string): Promise<void> => {
  await tabNamed(page, label).click({ button: 'right' });
  await page
    .locator('.lm-Menu .lm-Menu-item:visible', { hasText: 'Reload Page' })
    .click();
};

// The address the frame shows now, read by Playwright, so a cross-origin
// frame can be read too.
const frameUrl = async (page: any, label: string): Promise<string> => {
  const id = `page-${label.replace(/\W/g, '-')}`;
  const frame = await page.locator(`#${id} iframe`).elementHandle();
  return (await frame.contentFrame()).url();
};

const frameOf = (page: any, label: string): any =>
  page.frameLocator(`#page-${label.replace(/\W/g, '-')} iframe`);

const count = (seen: string[], path: string): number =>
  seen.filter(p => p === path).length;

const LINKED: IReply = {
  contentType: 'text/html',
  body: '<!doctype html><html><body><a href="b.html">next</a></body></html>'
};

// ACC-TABS-75..79: Reload Page on the right-click menu of a web page tab.
test.describe('web page tab reload', () => {
  // The lab this suite starts sends a Content-Security-Policy of
  // default-src 'self' with no frame-src, which blocks every frame from another
  // origin, so the cross-origin page of ACC-TABS-78 could not load.
  test.use({ bypassCSP: true });

  // Unrouted for the same reason as the favicon tests: a routed page aborts
  // the favicon request test 79 needs.
  test.beforeEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test.afterEach(() => {
    for (const server of servers.splice(0)) {
      server.closeAllConnections();
      server.close();
    }
  });

  test('reloads the page in the frame and not the lab', async ({ page }) => {
    const { port, seen } = await startServer({ '/': html() });
    await addPage(page, 'Reload menu', `/proxy/${port}/`);
    await expect(frameOf(page, 'Reload menu').locator('body')).toHaveText(
      'page'
    );
    expect(count(seen, '/')).toBe(1);
    await page.evaluate(() => ((window as any).reloadMarker = 'kept'));

    await reloadPage(page, 'Reload menu');

    await expect.poll(() => count(seen, '/')).toBe(2);
    await expect(frameOf(page, 'Reload menu').locator('body')).toHaveText(
      'page'
    );
    // Room for a lab reload the command might set off after the frame's.
    await page.waitForTimeout(1000);
    expect(await page.evaluate(() => (window as any).reloadMarker)).toBe(
      'kept'
    );
  });

  test('lists Reload Page only on web page tabs', async ({ page }) => {
    const { port } = await startServer({ '/': html() });
    await addPage(page, 'Reload scope', `/proxy/${port}/`);
    // A terminal tab is labelled only once its session is up, so the other
    // tabs are found by the widget id the shell puts on the tab.
    const open = (command: string, args: any): Promise<string> =>
      page.evaluate(
        async ([id, options]: [string, any]) =>
          (await (window as any).jupyterapp.commands.execute(id, options)).id,
        [command, args]
      );
    const notebook = await open('notebook:create-new', {
      kernelName: 'python3'
    });
    const terminal = await open('terminal:create-new', {});

    expect(await tabMenu(page, tabNamed(page, 'Reload scope'))).toContain(
      'Reload Page'
    );
    for (const id of [notebook, terminal]) {
      const items = await tabMenu(
        page,
        page.locator(`.lm-DockPanel-tabBar .lm-TabBar-tab[data-id="${id}"]`)
      );
      expect(items).toContain('Close Tab');
      expect(items).not.toContain('Reload Page');
    }
  });

  test('reloads the page a same-origin frame shows now', async ({ page }) => {
    const { port, seen } = await startServer({
      '/a.html': LINKED,
      '/b.html': html()
    });
    const origin = await page.evaluate(() => location.origin);
    await addPage(page, 'Reload current', `/proxy/${port}/a.html`);
    await frameOf(page, 'Reload current').locator('a').click();
    await expect(frameOf(page, 'Reload current').locator('body')).toHaveText(
      'page'
    );
    expect(count(seen, '/b.html')).toBe(1);

    await reloadPage(page, 'Reload current');

    await expect.poll(() => count(seen, '/b.html')).toBe(2);
    await expect(frameOf(page, 'Reload current').locator('body')).toHaveText(
      'page'
    );
    expect(count(seen, '/a.html')).toBe(1);
    expect(await frameUrl(page, 'Reload current')).toBe(
      `${origin}/proxy/${port}/b.html`
    );
  });

  // The lab runs on localhost, so 127.0.0.1 is another origin.
  test('reloads the opened address of a cross-origin frame', async ({
    page
  }) => {
    const { port, seen } = await startServer({
      '/a.html': LINKED,
      '/b.html': html()
    });
    await addPage(page, 'Reload opened', `http://127.0.0.1:${port}/a.html#top`);
    await frameOf(page, 'Reload opened').locator('a').click();
    await expect(frameOf(page, 'Reload opened').locator('body')).toHaveText(
      'page'
    );
    expect(count(seen, '/a.html')).toBe(1);

    await reloadPage(page, 'Reload opened');

    await expect.poll(() => count(seen, '/a.html')).toBe(2);
    await expect(frameOf(page, 'Reload opened').locator('a')).toHaveText(
      'next'
    );
    expect(await frameUrl(page, 'Reload opened')).toMatch(
      new RegExp(
        `^http://127\\.0\\.0\\.1:${port}/a\\.html\\?_jlreload=\\d+#top$`
      )
    );
    expect(count(seen, '/b.html')).toBe(1);

    // The frame shows the opened address with its #fragment now.
    await reloadPage(page, 'Reload opened');

    await expect.poll(() => count(seen, '/a.html')).toBe(3);
  });

  // DEF-TABS-92: a page the browser may keep for an hour is fetched again.
  test('reloads a cross-origin page past its cached copy', async ({ page }) => {
    const body = (text: string): IReply => ({
      contentType: 'text/html',
      headers: { 'Cache-Control': 'max-age=3600' },
      body: `<!doctype html><html><body>${text}</body></html>`
    });
    const replies = { '/cached.html': body('v1') };
    const { port, seen } = await startServer(replies);
    await addPage(
      page,
      'Reload cached',
      `http://127.0.0.1:${port}/cached.html`
    );
    await expect(frameOf(page, 'Reload cached').locator('body')).toHaveText(
      'v1'
    );
    replies['/cached.html'] = body('v2');

    await reloadPage(page, 'Reload cached');

    await expect.poll(() => count(seen, '/cached.html')).toBe(2);
    await expect(frameOf(page, 'Reload cached').locator('body')).toHaveText(
      'v2'
    );
  });

  // DEF-TABS-91: a page asks before it leaves only after the user acted in
  // it, so the test types into it first.
  test('shows the leave prompt of a cross-origin frame', async ({ page }) => {
    const { port, seen } = await startServer({
      '/form.html': {
        contentType: 'text/html',
        body:
          '<!doctype html><html><body><input><script>' +
          "addEventListener('beforeunload', e => {" +
          " e.preventDefault(); e.returnValue = ''; });" +
          '</script></body></html>'
      }
    });
    await addPage(page, 'Reload prompt', `http://127.0.0.1:${port}/form.html`);
    const input = frameOf(page, 'Reload prompt').locator('input');
    await input.click();
    await input.pressSequentially('draft');
    expect(count(seen, '/form.html')).toBe(1);
    const dialogs: string[] = [];
    page.on('dialog', (dialog: any) => {
      dialogs.push(dialog.type());
      void dialog.accept();
    });
    const entries = await page.evaluate(() => history.length);

    await reloadPage(page, 'Reload prompt');

    await expect.poll(() => dialogs).toEqual(['beforeunload']);
    await expect.poll(() => count(seen, '/form.html')).toBe(2);
    expect(dialogs).toEqual(['beforeunload']);
    // The reload adds no session history entry once the new page has loaded.
    await expect(input).toHaveValue('');
    expect(await page.evaluate(() => history.length)).toBe(entries);

    // An opened address with a #fragment shows the prompt as well.
    await addPage(page, 'Reload top', `http://127.0.0.1:${port}/form.html#top`);
    const top = frameOf(page, 'Reload top').locator('input');
    await top.click();
    await top.pressSequentially('draft');

    await reloadPage(page, 'Reload top');

    await expect.poll(() => dialogs).toEqual(['beforeunload', 'beforeunload']);
    await expect(top).toHaveValue('');
  });

  test('keeps the tab position, label and icon', async ({ page }) => {
    const { port, seen } = await startServer({
      '/': html(),
      '/favicon.ico': png(RED)
    });
    const origin = await page.evaluate(() => location.origin);
    await addPage(page, 'Reload keeps', `/proxy/${port}/`);
    await expect
      .poll(async () => (await readTab(page, 'Reload keeps')).favicon)
      .toBe(`${origin}/proxy/${port}/favicon.ico`);
    // A tab after it, so a tab that moved to the end would show.
    await addPage(page, 'Reload neighbour', 'https://example.invalid/');
    await expect
      .poll(async () => (await readTab(page, 'Reload neighbour')).found)
      .toBe(true);

    // The tab is sampled on every animation frame through the reload, so an
    // empty slot or a globe that shows for one frame is caught as well.
    const before = await page.evaluate(() => {
      const w = window as any;
      w.reloadTabState = () => {
        const tabs = [
          ...document.querySelectorAll<HTMLElement>(
            '#jp-main-dock-panel .lm-TabBar-tab'
          )
        ];
        const tab = tabs.find(
          t =>
            t.querySelector('.lm-TabBar-tabLabel')?.textContent?.trim() ===
            'Reload keeps'
        );
        const host = tab?.querySelector('.lm-TabBar-tabIcon');
        return JSON.stringify({
          tabs: tabs.length,
          index: tab ? [...tab.parentElement!.children].indexOf(tab) : -1,
          icon: host
            ?.querySelector('svg[data-icon]')
            ?.getAttribute('data-icon'),
          favicon: host?.querySelector('svg image')?.getAttribute('href')
        });
      };
      w.reloadSamples = new Set<string>();
      w.reloadSampling = true;
      const sample = (): void => {
        w.reloadSamples.add(w.reloadTabState());
        if (w.reloadSampling) {
          requestAnimationFrame(sample);
        }
      };
      sample();
      return w.reloadTabState();
    });

    await reloadPage(page, 'Reload keeps');

    await expect.poll(() => count(seen, '/')).toBe(2);
    await expect(frameOf(page, 'Reload keeps').locator('body')).toHaveText(
      'page'
    );
    // Room for anything the reload set off to reach the tab.
    await page.waitForTimeout(1000);
    const samples = await page.evaluate(() => {
      const w = window as any;
      w.reloadSampling = false;
      return [...w.reloadSamples];
    });
    expect(JSON.parse(before)).toEqual({
      tabs: expect.any(Number),
      index: expect.any(Number),
      icon: `jupyterlab_vscode_icons_extension:favicon:${origin}/proxy/${port}/favicon.ico`,
      favicon: `${origin}/proxy/${port}/favicon.ico`
    });
    expect(JSON.parse(before).index).toBeGreaterThanOrEqual(0);
    expect(samples).toEqual([before]);
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
