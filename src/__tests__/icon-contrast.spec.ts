/**
 * Icon contrast - part of ACC-COLOUR-12 and all of ACC-COLOUR-13.
 *
 * WCAG 1.4.11 asks for 3:1 between a non-text UI component and its background.
 * The glyphs measured here are the ones this project draws in a single
 * colour of its own: the database cylinder, the BPMN tile, the Makefile sheet
 * and the .mcp.json mark. They are not the whole
 * set of colours this project chooses - the hand-drawn Makefile, .mcp.json and
 * markdown glyphs carry their own fills, and DEF-COLOUR-21 records that three
 * of them sit under the bar.
 *
 * Every colour is read out of src/index.ts rather than re-typed here, so
 * recolouring the artwork moves this test. A test that re-types the value
 * passes whatever the product ships, which is what this file used to do.
 */

import { CONTRAST_BAR } from '../contrast';

const source: string = require('fs').readFileSync(
  require('path').join(__dirname, '..', 'index.ts'),
  'utf8'
);

/**
 * The first fill of a named svg constant in src/index.ts.
 *
 * The search is bounded to the constant's own template literal, and three-digit
 * fills count. Neither was true before: a fixed 4000-character window with a
 * six-digit-only pattern walked straight out of `mcpSvg`, whose only fill is
 * `#eee`, and returned the first colour of the constant that follows it. The
 * two mcp assertions were measuring the Prettier palette and could not fail for
 * their own subject - an adversarial review found it.
 */
const fillOf = (constName: string): string => {
  const at = source.indexOf(`const ${constName} =`);
  if (at < 0) {
    throw new Error(`${constName} is gone from src/index.ts`);
  }
  const end = source.indexOf('`;', at);
  const body = source.slice(at, end < 0 ? at + 4000 : end);
  const match = body.match(/fill="(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})"/);
  if (!match) {
    throw new Error(`no fill found in ${constName}`);
  }
  const value = match[1].toLowerCase();
  return value.length === 4
    ? '#' +
        value
          .slice(1)
          .split('')
          .map(c => c + c)
          .join('')
    : value;
};

/** The recolour the selected-row variant applies, read from the call itself. */
const dbRecolour = (): { from: string; to: string } => {
  const match = source.match(
    /dbSvg\.replace\(\/(#[0-9a-fA-F]{6})\/g,\s*'(#[0-9a-fA-F]{6})'\)/
  );
  if (!match) {
    throw new Error('the selected-row recolour of dbSvg is gone');
  }
  return { from: match[1].toLowerCase(), to: match[2].toLowerCase() };
};

const srgbToLinear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

const relativeLuminance = (hex: string): number => {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
};

const contrast = (a: string, b: string): number => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
};

// The colours this extension sets, read from the artwork that ships, and the
// JupyterLab backgrounds they land on (--jp-layout-color1 and --jp-brand-color1
// in the stock light and dark themes).
const RECOLOUR = dbRecolour();
const stylesheet: string = require('fs').readFileSync(
  require('path').join(__dirname, '..', '..', 'style', 'base.css'),
  'utf8'
);

/** The fill a rule gives one of this project's glyph classes. */
const ruleFill = (selector: string): string => {
  const at = stylesheet.indexOf(selector);
  if (at < 0) {
    throw new Error(`${selector} is gone from style/base.css`);
  }
  const match = stylesheet
    .slice(at, at + 200)
    .match(/fill:\s*#([0-9a-fA-F]{3,6})/);
  if (!match) {
    throw new Error(`no fill in the rule for ${selector}`);
  }
  // stylelint shortens #ffffff to #fff, so expand the three-digit form.
  const value = match[1].toLowerCase();
  return value.length === 3
    ? `#${value[0]}${value[0]}${value[1]}${value[1]}${value[2]}${value[2]}`
    : `#${value}`;
};
const DB_BLUE = fillOf('dbSvg');
const DB_SELECTED = RECOLOUR.to;
const PANEL_LIGHT = '#ffffff';
const PANEL_DARK = '#212121';
const BRAND_LIGHT = '#1976d2';
const BRAND_DARK = '#2196f3';
// The BPMN tile and the marks drawn on it - the extension's own artwork, not a
// vendor logo, so the whole glyph is a colour choice this project owns.
const BPMN_MARKS = '#ffffff';
const BPMN_TILE = fillOf('bpmnSvg');
const MAKEFILE_SHEET = fillOf('makefileSvg');
const MAKEFILE_SELECTED = ruleFill(
  '.jp-DirListing-item.jp-mod-selected .makefile-glyph'
);
// The bar is the product's own constant, not a value to re-type here.
const BAR = CONTRAST_BAR;

describe('contrast helper', () => {
  // Anchors the helper itself: black on white is the known extreme, so a broken
  // luminance function cannot quietly pass the table below.
  it('reports 21:1 for black on white', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('reports 1:1 for a colour against itself', () => {
    expect(contrast(DB_BLUE, DB_BLUE)).toBeCloseTo(1, 5);
  });
});

describe('database icon contrast', () => {
  it.each([
    ['light panel', DB_BLUE, PANEL_LIGHT],
    ['dark panel', DB_BLUE, PANEL_DARK],
    ['light selection band', DB_SELECTED, BRAND_LIGHT],
    ['dark selection band', DB_SELECTED, BRAND_DARK]
  ])('clears the 3:1 bar on the %s', (_label, colour, background) => {
    expect(contrast(colour, background)).toBeGreaterThanOrEqual(BAR);
  });

  it('is why the selected-row variant exists: the blue fails on the band', () => {
    // 1.07:1 - the defect that ACC-COLOUR-13 answers. If this ever clears the
    // bar the white variant has become unnecessary.
    expect(contrast(DB_BLUE, BRAND_DARK)).toBeLessThan(BAR);
  });

  it('recolours the cylinder that ships, not some other colour', () => {
    // The variant is built with dbSvg.replace(from, to). If the artwork is
    // recoloured and that call is not, the replace silently does nothing and
    // the selected row goes back to failing the bar.
    expect(RECOLOUR.from).toBe(DB_BLUE);
  });
});

describe('bpmn icon contrast', () => {
  // The maintainer asked for a square tile in a paler orange than the camunda
  // #fc5d0d it started from, and the two cannot both hold: lightening the tile
  // lowers the white marks against it and the tile against a light panel by the
  // same amount, because they are the same pair. The decision is his and
  // ACC-COLOUR-12 records it as an exception; these assertions pin the measured
  // cost so a later change to the colour has to face it.
  it('clears the 3:1 bar on the dark panel', () => {
    expect(contrast(BPMN_TILE, PANEL_DARK)).toBeGreaterThanOrEqual(BAR);
  });

  it('sits under the bar on the light panel, by his choice', () => {
    expect(contrast(BPMN_TILE, PANEL_LIGHT)).toBeCloseTo(2.72, 2);
    expect(contrast(BPMN_TILE, PANEL_LIGHT)).toBeLessThan(BAR);
  });

  it('carries the same cost for the marks drawn on it', () => {
    // White on the tile is the same pair as the tile on a white panel.
    expect(contrast(BPMN_MARKS, BPMN_TILE)).toBeCloseTo(
      contrast(BPMN_TILE, PANEL_LIGHT),
      5
    );
  });

  it('would have cleared the bar at the colour it replaced', () => {
    expect(contrast('#fc5d0d', PANEL_LIGHT)).toBeGreaterThanOrEqual(BAR);
  });
});

/** Every path element of a named svg constant in src/index.ts. */
const pathsOf = (constName: string): string[] => {
  const at = source.indexOf(`const ${constName} =`);
  if (at < 0) {
    throw new Error(`${constName} is gone from src/index.ts`);
  }
  const end = source.indexOf('`;', at);
  const body = source.slice(at, end < 0 ? at + 40000 : end);
  return body.match(/<path\b[^>]*>/g) || [];
};

describe('icons a tab paints as a background', () => {
  // DEF-COLOUR-27-2. markTabIcons encodes a registered icon into a data-URI
  // background, and document CSS cannot reach inside one: a path whose colour
  // comes only from a class rasterises with the svg default, black. The shell
  // tile and the joblib ink therefore carry their colours in the artwork, and
  // those values clear 3:1 on both panels so the data URI needs nothing
  // per-theme. A row is the other surface: it renders the LabIcon as inline
  // svg, which document CSS does reach - probed live, injecting a rule on
  // .shell-tile changed a .sh row's rendered fill. So the shell artwork carries
  // both, the fill for the tab and lab's own class for the row, and the two
  // never compete because a CSS fill outranks a presentation attribute.
  const SHELL_TILE = fillOf('shellSvg');
  const JOBLIB_INK = fillOf('joblibSvg');

  it('gives every shell path an explicit fill', () => {
    const paths = pathsOf('shellSvg');
    expect(paths.length).toBeGreaterThan(0);
    // Three or six digits: the glyph on the tile is drawn #fff.
    paths.forEach(path => expect(path).toMatch(/fill="#[0-9a-fA-F]{3,6}"/));
  });

  it('gives every joblib path an explicit fill', () => {
    const paths = pathsOf('joblibSvg');
    expect(paths.length).toBeGreaterThan(0);
    paths.forEach(path => expect(path).toMatch(/fill="#[0-9a-fA-F]{3,6}"/));
  });

  it('gives every shell path a baked fill and lab theme classes', () => {
    // Asserting the pair is what the earlier form could not do: it asserted the
    // class was absent, which pinned the tab and silently cost the row the
    // theme contrast lab gives its own icons - 10.05:1 light and 13.88:1 dark,
    // against 4.54 and 3.55 from the baked value. The sibling batch tile has
    // carried both all along.
    const paths = pathsOf('shellSvg');
    expect(paths.length).toBeGreaterThan(1);
    paths.forEach(path => {
      expect(path).toMatch(/fill="#[0-9a-fA-F]{3,6}"/);
      expect(path).toMatch(/jp-terminal-icon-(background-)?color/);
      expect(path).toMatch(/jp-icon-selectable/);
    });
  });

  it('clears the bar with the shell tile on both panels', () => {
    expect(contrast(SHELL_TILE, PANEL_LIGHT)).toBeGreaterThanOrEqual(BAR);
    expect(contrast(SHELL_TILE, PANEL_DARK)).toBeGreaterThanOrEqual(BAR);
  });

  it('clears the bar with the joblib ink on both panels', () => {
    expect(contrast(JOBLIB_INK, PANEL_LIGHT)).toBeGreaterThanOrEqual(BAR);
    expect(contrast(JOBLIB_INK, PANEL_DARK)).toBeGreaterThanOrEqual(BAR);
  });

  it('gives every path of that ink the class the recolour names', () => {
    // The stylesheet rule below recolours `.joblib-glyph`. An adversarial
    // review found the mark's second path carrying the same ink with no class,
    // so a selected row turned one cog white and left the other at 1.01:1
    // against the band - an invisible silhouette. Matching the stylesheet text
    // alone could not catch that, because the rule was never the broken half.
    const inked = pathsOf('joblibSvg').filter(path =>
      path.includes(`fill="${JOBLIB_INK}"`)
    );
    expect(inked.length).toBeGreaterThan(1);
    inked.forEach(path => expect(path).toContain('class="joblib-glyph"'));
  });

  it('turns both white on a selected row, where the drawn colours vanish', () => {
    // 1.01:1 for the tile and 1.22:1 for the ink against the light selection
    // band, so the stylesheet that ships recolours the selected state - the
    // remedy ACC-COLOUR-13 established for the database cylinder.
    expect(contrast(SHELL_TILE, BRAND_LIGHT)).toBeLessThan(BAR);
    expect(contrast(JOBLIB_INK, BRAND_LIGHT)).toBeLessThan(BAR);
    expect(stylesheet).toMatch(
      /\.jp-DirListing-item\.jp-mod-selected \.joblib-glyph,\s*\n\s*\.jp-DirListing-item\.jp-mod-selected \.shell-tile \{\s*\n\s*fill: #fff;/
    );
  });
});

describe('mcp glyph contrast', () => {
  // DEF-COLOUR-21: the artwork is #eee, 13.9:1 on the dark panel and 1.16:1 on
  // the light one. The light theme recolours it through a class, and because
  // .mcp.json is always a dotfile the row is dimmed to 55 percent, which is why
  // the light value is #212121 rather than #424242.
  //
  // These cases have now been lost twice - once to a rewrite of this file and
  // once to my own over-broad cleanup of another block - which is how the
  // tracker came to claim coverage that did not exist. The binding assertion is
  // the one that matters: without it, deleting the class from the artwork fails
  // nothing.
  const MCP_DARK = fillOf('mcpSvg');
  const MCP_LIGHT = ruleFill("body[data-jp-theme-light='true'] .mcp-glyph");

  it('keeps the drawn colour on the dark panel', () => {
    expect(contrast(MCP_DARK, PANEL_DARK)).toBeGreaterThanOrEqual(BAR);
  });

  it('recolours for the light panel, where the drawn colour fails', () => {
    expect(contrast(MCP_DARK, PANEL_LIGHT)).toBeLessThan(BAR);
    expect(contrast(MCP_LIGHT, PANEL_LIGHT)).toBeGreaterThanOrEqual(BAR);
  });

  it('binds the artwork to the rule that recolours it', () => {
    const at = source.indexOf('const mcpSvg =');
    expect(source.slice(at, at + 2000)).toContain('class="mcp-glyph"');
  });
});

describe('makefile sheet contrast', () => {
  // DEF-COLOUR-21: the sheet reads on both panels and vanishes on the light
  // selection band at 1.02:1, so it takes the same selected-row variant the
  // database cylinder got. This block was lost once to an over-broad cleanup of
  // a neighbouring one, which left its constants orphaned - hence the binding
  // assertion at the end.
  it.each([
    ['light panel', PANEL_LIGHT],
    ['dark panel', PANEL_DARK]
  ])('the sheet clears the bar on the %s', (_label, background) => {
    expect(contrast(MAKEFILE_SHEET, background)).toBeGreaterThanOrEqual(BAR);
  });

  it.each([
    ['light selection band', BRAND_LIGHT],
    ['dark selection band', BRAND_DARK]
  ])('the selected variant clears the bar on the %s', (_label, band) => {
    expect(contrast(MAKEFILE_SELECTED, band)).toBeGreaterThanOrEqual(BAR);
  });

  it('is why the variant exists: the sheet fails on the light band', () => {
    expect(contrast(MAKEFILE_SHEET, BRAND_LIGHT)).toBeLessThan(BAR);
  });

  it('binds the artwork to the rule that recolours it', () => {
    const at = source.indexOf('const makefileSvg =');
    expect(source.slice(at, at + 4000)).toContain('class="makefile-glyph"');
  });
});

describe('selected-row recolour reaches every ink path', () => {
  // The architect lens found the joblib artwork with two ink paths and the
  // class on only one, so a selected row whitened one gear and left the other
  // at 1.22:1 against the band. The rule can only reach what carries the class,
  // so the artwork is asserted path by path.
  it.each([
    ['joblibSvg', 'joblib-glyph'],
    ['mcpSvg', 'mcp-glyph'],
    ['makefileSvg', 'makefile-glyph']
  ])('every ink path of %s carries %s', (constName, className) => {
    const paths = pathsOf(constName as string);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path).toContain(`class="${className}"`);
    }
  });
});
