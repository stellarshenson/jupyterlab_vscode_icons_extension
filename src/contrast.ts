/**
 * Contrast measurement for painted glyphs.
 *
 * A glyph painted as a background image is an isolated document: the page's
 * stylesheet cannot reach inside it, so the artwork's own colours are all it
 * has. The bundled vscode-icons set was drawn for VSCode's dark sidebar, and
 * some of it has no perceivable contrast against a JupyterLab tab bar, which is
 * what these functions decide (WCAG 1.4.11 asks for 3:1 between a non-text
 * component and its background).
 *
 * They live in their own module rather than inside the plugin's activate
 * closure so that a unit test can state the decision for a given artwork and
 * background. The two defects this guards against - a gradient glyph outlined
 * although it is legible, and a decision cached across a theme change - both
 * shipped while the only coverage was one end-to-end case over two files.
 */

/** The WCAG bar for a non-text component against its background. */
export const CONTRAST_BAR = 3;

export const relativeLuminance = (r: number, g: number, b: number): number => {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/**
 * A CSS colour as three channels, or null when it is not one this can read.
 * getComputedStyle always hands back the comma rgb()/rgba() form; the hex forms
 * are what the artwork itself carries.
 */
export const parseColour = (value: string): [number, number, number] | null => {
  const rgb = value.match(/rgba?\(([^)]+)\)/);
  if (rgb) {
    const parts = rgb[1].split(',').map(part => parseFloat(part));
    if (parts.length >= 3 && parts.every(part => !isNaN(part))) {
      return [parts[0], parts[1], parts[2]];
    }
    return null;
  }
  const hex = value.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!hex) {
    return null;
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

/** The WCAG ratio between two colours, or null if either is unreadable. */
export const contrastRatio = (a: string, b: string): number | null => {
  const first = parseColour(a);
  const second = parseColour(b);
  if (!first || !second) {
    return null;
  }
  const la = relativeLuminance(first[0], first[1], first[2]);
  const lb = relativeLuminance(second[0], second[1], second[2]);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/**
 * The colours the artwork is measured by. The stated colours are hex values
 * only, and missing one makes a legible glyph look colourless - which this
 * measure reads as cannot be seen:
 *
 * - a stated `fill`
 * - a gradient `stop-color`: eight mapped glyphs (python, rust, r, swift,
 *   kotlin, vite, rollup, license) carry no plain fill at all and colour
 *   themselves entirely through stops
 *
 * Named colours (`fill="gray"`) and stroke colours are not read. Black is
 * added for a painting element that states no fill and inherits none from an
 * ancestor, because that is what SVG paints it. Measured over the 72 mapped
 * keys, that clause changes the decision for js-official, dotenv and svg: each
 * pairs a pale tile with lettering that states no fill, so reading only stated
 * colours saw the tile alone and outlined artwork that measures up to 21:1 on
 * its own.
 */
export const artworkColours = (svgstr: string): string[] => {
  const stated =
    svgstr.match(/(?:fill|stop-color)="(#[0-9a-fA-F]{3,6})"/g) || [];
  const colours = stated
    .map(attribute => {
      const colour = attribute.match(/"(#[0-9a-fA-F]{3,6})"/);
      return colour ? colour[1] : '';
    })
    .filter(Boolean);

  // `fill="none"` and a url() reference are both stated; only an element with
  // no fill attribute at all falls back to SVG's black.
  const painting = /<(?:path|circle|rect|ellipse|polygon|polyline)\b([^>]*)>/g;
  let element = painting.exec(svgstr);
  while (element) {
    if (!/\bfill=/.test(element[1])) {
      colours.push('#000000');
      break;
    }
    element = painting.exec(svgstr);
  }
  return colours;
};

/**
 * The artwork with its stated colours shifted by one shared mix fraction, or
 * null when the artwork states no colour that can be substituted.
 *
 * A background image cannot inherit `currentColor` or follow a page rule, so
 * the only treatment that leaves the cutouts transparent is to rewrite the
 * colours the artwork states itself. One fraction is computed from the unique
 * hex `fill` and `stop-color` values below the bar: each is mixed toward black
 * or white - whichever pole has the higher ratio against `background` - in 1%
 * steps until it clears the bar with a small margin, and the largest of those
 * steps is applied to every stated colour. The shared fraction keeps the
 * artwork's colours apart, where stopping each colour at the bar would collapse
 * them onto one luminance. Artwork whose colours all clear the bar is returned
 * unchanged.
 *
 * Only hex `fill` and `stop-color` values are rewritten. Named colours,
 * `fill="none"`, `url(#...)`, `currentColor` and stroke colours are left
 * alone, so a shape painted only by its stroke is not corrected here.
 *
 * Null means the caller must keep its other treatment: a class-coloured path
 * has no stated colour to rewrite, and inside a data URI it is painted black,
 * so this function cannot correct it.
 */
export const recolourForContrast = (
  svgstr: string,
  background: string
): string | null => {
  const stated =
    svgstr.match(/(?:fill|stop-color)="(#[0-9a-fA-F]{3,6})"/g) || [];
  if (stated.length === 0) {
    return null;
  }
  const black = contrastRatio('#000000', background) ?? 0;
  const white = contrastRatio('#ffffff', background) ?? 0;
  const pole = black >= white ? 0 : 255;
  // The replacement regex rewrites stated hex values only, so the shared
  // fraction is computed from those and not from artworkColours' synthesized
  // default black: an element with no fill attribute cannot inflate it.
  const colours = new Set(
    stated
      .map(attribute => attribute.match(/"(#[0-9a-fA-F]{3,6})"/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map(match => match[1].toLowerCase())
  );
  let shared = 0;
  for (const colour of colours) {
    const ratio = contrastRatio(colour, background);
    if (ratio === null || ratio >= CONTRAST_BAR) {
      continue;
    }
    const channels = parseColour(colour);
    if (!channels) {
      continue;
    }
    for (let step = 1; step <= 100; step++) {
      const mixed = channels.map(channel =>
        Math.round(channel + ((pole - channel) * step) / 100)
      );
      const candidate = `#${mixed
        .map(value => value.toString(16).padStart(2, '0'))
        .join('')}`;
      const candidateRatio = contrastRatio(candidate, background);
      if (candidateRatio !== null && candidateRatio >= CONTRAST_BAR + 0.05) {
        shared = Math.max(shared, step);
        break;
      }
    }
  }
  if (shared === 0) {
    return svgstr;
  }
  return svgstr.replace(
    /(fill|stop-color)="(#[0-9a-fA-F]{3,6})"/g,
    (attribute, name: string, value: string) => {
      const channels = parseColour(value);
      if (!channels) {
        return attribute;
      }
      const mixed = channels.map(channel =>
        Math.round(channel + ((pole - channel) * shared) / 100)
      );
      const repainted = `#${mixed
        .map(channel => channel.toString(16).padStart(2, '0'))
        .join('')}`;
      return `${name}="${repainted}"`;
    }
  );
};

/**
 * True when the artwork's best colour the measure reads (a stated hex, or the
 * black an unfilled element paints) is below the bar against `background`.
 *
 * The measure runs over `artworkColours` and the best ratio wins, so an
 * artwork with one legible colour is not outlined. Artwork that states no
 * colour of its own takes one from the page's stylesheet, which a background
 * image cannot reach, so it cannot be relied on and is treated as needing the
 * edge.
 */
export const needsOutlineOn = (svgstr: string, background: string): boolean => {
  const colours = artworkColours(svgstr);
  if (colours.length === 0) {
    return true;
  }
  let best = 0;
  for (const colour of colours) {
    const ratio = contrastRatio(colour, background);
    if (ratio && ratio > best) {
      best = ratio;
    }
  }
  return best > 0 && best < CONTRAST_BAR;
};
