/**
 * The painted-glyph contrast measure - the guard for DEF-COLOUR-32.
 *
 * Both of the defects this measure shipped with were invisible to the one
 * end-to-end case that covered it: a gradient glyph was outlined although it is
 * legible, and the decision was cached across a theme change. This states the
 * decision for real artwork against the four backgrounds JupyterLab's own
 * themes put behind a tab.
 */

import {
  artworkColours,
  contrastRatio,
  needsOutlineOn,
  parseColour,
  relativeLuminance
} from '../contrast';
import { generateIconSVG } from '../icons';

// The tab backgrounds the stock themes render: current and inactive, each
// theme. getComputedStyle hands them back in this form.
const LIGHT_CURRENT = 'rgb(255, 255, 255)';
const LIGHT_INACTIVE = 'rgb(238, 238, 238)';
const DARK_CURRENT = 'rgb(33, 33, 33)';
const DARK_INACTIVE = 'rgb(66, 66, 66)';

describe('parseColour', () => {
  it('reads the computed rgb form', () => {
    expect(parseColour('rgb(255, 255, 255)')).toEqual([255, 255, 255]);
    expect(parseColour('rgba(33, 33, 33, 0.5)')).toEqual([33, 33, 33]);
  });

  it('reads both hex forms the artwork uses', () => {
    expect(parseColour('#ffe885')).toEqual([255, 232, 133]);
    expect(parseColour('#eee')).toEqual([238, 238, 238]);
  });

  it('refuses what it cannot read rather than guessing', () => {
    expect(parseColour('currentColor')).toBeNull();
    expect(parseColour('url(#gradient)')).toBeNull();
    expect(parseColour('')).toBeNull();
  });
});

describe('relativeLuminance and contrastRatio', () => {
  it('puts black on white at the known extreme', () => {
    expect(relativeLuminance(0, 0, 0)).toBeCloseTo(0, 5);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('is null when either side is unreadable', () => {
    expect(contrastRatio('url(#g)', '#ffffff')).toBeNull();
  });
});

describe('artworkColours', () => {
  it('reads plain fills', () => {
    expect(artworkColours('<svg><path fill="#ffe885"/></svg>')).toEqual([
      '#ffe885'
    ]);
  });

  // Eight mapped glyphs carry no plain fill at all: reading only `fill` made
  // them look colourless, and a colourless artwork is treated as needing the
  // edge, so a .py tab - the most common tab in a JupyterLab - was outlined.
  it('reads gradient stops, which some glyphs colour themselves with', () => {
    const python = generateIconSVG('file-type-python');
    expect(python).toContain('url(#');
    expect(python.match(/fill="#[0-9a-fA-F]{3,6}"/)).toBeNull();
    expect(artworkColours(python).length).toBeGreaterThan(0);
  });

  it('reads a class-coloured path as the black SVG will paint it', () => {
    // The class resolves when JupyterLab renders the svg inline, and not at all
    // inside a data-URI background, where the path is painted black - which is
    // what the joblib glyph measurably does on a tab. Black is the honest
    // answer for this context, and it is legible on a light tab and not on a
    // dark one, which the two cases below pin.
    expect(
      artworkColours('<svg><path class="joblib-glyph" d="M0 0"/></svg>')
    ).toEqual(['#000000']);
  });
});

describe('needsOutlineOn', () => {
  // The pairing is what decides, not the glyph: the same yaml wordmark is
  // unreadable on a light tab and excellent on a dark one.
  it.each([
    ['file-type-yaml', LIGHT_CURRENT, true],
    ['file-type-yaml', LIGHT_INACTIVE, true],
    ['file-type-yaml', DARK_CURRENT, false],
    ['file-type-yaml', DARK_INACTIVE, false],
    ['file-type-markdown', DARK_CURRENT, true],
    ['file-type-markdown', LIGHT_CURRENT, false],
    ['file-type-jar', LIGHT_CURRENT, false]
  ])('%s on %s -> %s', (key, background, expected) => {
    expect(needsOutlineOn(generateIconSVG(key as string), background)).toBe(
      expected
    );
  });

  // A gradient glyph is legible and must not be outlined on either theme.
  it.each([
    ['file-type-python', LIGHT_CURRENT],
    ['file-type-python', DARK_CURRENT],
    ['file-type-rust', LIGHT_CURRENT],
    ['file-type-r', LIGHT_CURRENT]
  ])('leaves the gradient glyph %s alone on %s', (key, background) => {
    expect(needsOutlineOn(generateIconSVG(key as string), background)).toBe(
      false
    );
  });

  it.each([
    [DARK_CURRENT, true],
    [LIGHT_CURRENT, false]
  ])(
    'treats a class-coloured artwork as black on %s -> outline %s',
    (background, expected) => {
      expect(
        needsOutlineOn('<svg><path class="joblib-glyph"/></svg>', background)
      ).toBe(expected);
    }
  );
});

describe('artwork that paints with SVG default black', () => {
  // An element with no fill attribute is painted black by SVG. Reading only
  // stated colours saw the pale tile of these glyphs and nothing else, so the
  // measure marked artwork that is legible on its own: js-official renders
  // 21:1 on a white tab, dotenv 16.5:1, zip 4.3:1.
  it.each([
    'file-type-js-official',
    'file-type-dotenv',
    'file-type-zip',
    'file-type-svg'
  ])('%s is not outlined on a light tab', key => {
    expect(needsOutlineOn(generateIconSVG(key), LIGHT_CURRENT)).toBe(false);
  });

  it('counts the default only when no fill is stated', () => {
    // fill="none" and a gradient reference are both stated, so neither pulls
    // black into the set.
    expect(
      artworkColours('<svg><path fill="none" stroke="#fff"/></svg>')
    ).toEqual([]);
    expect(artworkColours('<svg><path fill="url(#g)"/></svg>')).toEqual([]);
    expect(artworkColours('<svg><path d="M0 0"/></svg>')).toEqual(['#000000']);
  });

  it('still outlines the glyph the rule was built for', () => {
    expect(
      needsOutlineOn(generateIconSVG('file-type-yaml'), LIGHT_CURRENT)
    ).toBe(true);
  });
});
