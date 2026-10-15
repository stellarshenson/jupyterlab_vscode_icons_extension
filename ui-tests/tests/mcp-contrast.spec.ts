import { expect, test } from '@jupyterlab/galata';

// Measure the rendered SVG ink against its actual row background, compositing
// both through every ancestor's opacity. A flat fill/background comparison
// misses the dotfile rule, which dims the entire selection band as well.
const renderedContrast = (row: any) =>
  row.evaluate((item: HTMLElement) => {
    type Pixel = [number, number, number, number];
    const rgba = (value: string): Pixel => {
      const channels = value.match(/[\d.]+/g)!.map(Number);
      return [channels[0], channels[1], channels[2], channels[3] ?? 1];
    };
    const over = (front: Pixel, back: Pixel): Pixel => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      return [
        ...[0, 1, 2].map(channel =>
          alpha
            ? (front[channel] * front[3] +
                back[channel] * back[3] * (1 - front[3])) /
              alpha
            : 0
        ),
        alpha
      ] as Pixel;
    };
    const luminance = (pixel: Pixel) =>
      pixel.slice(0, 3).reduce((sum, channel, index) => {
        const c = channel / 255;
        const linear =
          c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        return sum + linear * [0.2126, 0.7152, 0.0722][index];
      }, 0);
    const glyphs = [...item.querySelectorAll('.mcp-glyph')];
    const ratios = glyphs.map(glyph => {
      let ink = rgba(getComputedStyle(glyph).fill);
      ink[3] *= Number(getComputedStyle(glyph).fillOpacity);
      let background: Pixel = [0, 0, 0, 0];
      for (let node: Element | null = glyph; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        const under = rgba(style.backgroundColor);
        ink = over(ink, under);
        background = over(background, under);
        ink[3] *= Number(style.opacity);
        background[3] *= Number(style.opacity);
      }
      const white: Pixel = [255, 255, 255, 1];
      const a = luminance(over(ink, white));
      const b = luminance(over(background, white));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    const style = getComputedStyle(item);
    return {
      ratios,
      opacity: Number(style.opacity),
      background: style.backgroundColor,
      fills: glyphs.map(glyph => getComputedStyle(glyph).fill),
      visible: glyphs.every(glyph => {
        for (
          let node: Element | null = glyph;
          node;
          node = node.parentElement
        ) {
          const computed = getComputedStyle(node);
          if (computed.display === 'none' || computed.visibility === 'hidden') {
            return false;
          }
        }
        return glyph.getBoundingClientRect().width > 0;
      })
    };
  });

test('MCP dotfile ink clears 3:1 on both panels and selection bands', async ({
  page,
  tmpPath
}) => {
  await page.contents.uploadContent('{}', 'text', `${tmpPath}/.mcp.json`);
  await page.contents.uploadContent(
    'ordinary',
    'text',
    `${tmpPath}/ordinary.txt`
  );
  await page.evaluate(async () => {
    const commands = (window as any).jupyterapp.commands;
    if (!commands.isToggled('filebrowser:toggle-hidden-files')) {
      await commands.execute('filebrowser:toggle-hidden-files');
    }
  });
  await page.filebrowser.openDirectory(tmpPath);
  const mcp = page.locator('.jp-DirListing-item').filter({
    has: page.locator('.jp-DirListing-itemText', { hasText: /^\.mcp\.json$/ })
  });
  const ordinary = page.locator('.jp-DirListing-item').filter({
    has: page.locator('.jp-DirListing-itemText', { hasText: /^ordinary\.txt$/ })
  });
  await expect(mcp.locator('.mcp-glyph')).toHaveCount(2);
  await expect(mcp).toHaveAttribute('data-is-dot', /.*/);

  for (const theme of ['JupyterLab Light', 'JupyterLab Dark']) {
    await page.theme.setTheme(theme);
    await expect(page.locator('body')).toHaveAttribute(
      'data-jp-theme-light',
      theme.endsWith('Light') ? 'true' : 'false'
    );
    for (const selected of [false, true]) {
      await (selected ? mcp : ordinary).click();
      await page.mouse.move(0, 0);
      if (selected) {
        await expect(mcp).toHaveClass(/jp-mod-selected/);
      } else {
        await expect(mcp).not.toHaveClass(/jp-mod-selected/);
      }
      await expect
        .poll(async () => (await renderedContrast(mcp)).opacity)
        .toBe(selected ? 1 : 0.55);
      const actual = await renderedContrast(mcp);
      expect(actual.visible, `${theme}, selected=${selected}`).toBe(true);
      for (const ratio of actual.ratios) {
        expect(
          ratio,
          JSON.stringify({ theme, selected, ...actual })
        ).toBeGreaterThanOrEqual(3);
      }
      if (selected) {
        expect(actual.fills).toEqual([
          'rgb(255, 255, 255)',
          'rgb(255, 255, 255)'
        ]);
        expect(actual.background).not.toBe('rgba(0, 0, 0, 0)');
      }
    }
  }
});
