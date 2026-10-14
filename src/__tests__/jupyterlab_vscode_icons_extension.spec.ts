/**
 * Icon resolution - the unit half of ACC-ICONS-1 and ACC-ICONS-3.
 *
 * The file browser and the document tabs both resolve a glyph through
 * `getIconForFile`, so a mapping that regresses here regresses in both places.
 */

import {
  generateIconSVG,
  getIconForFile,
  getIconSVG,
  getIconViewBox
} from '../icons';

describe('getIconForFile', () => {
  it.each([
    ['app.js', 'file-type-js-official'],
    ['main.py', 'file-type-python'],
    ['README.md', 'file-type-markdown'],
    ['diagram.svg', 'file-type-svg'],
    ['notebook.ipynb', 'file-type-jupyter']
  ])('maps %s to %s', (filename, expected) => {
    expect(getIconForFile(filename)).toBe(expected);
  });

  it('is case insensitive on the extension', () => {
    expect(getIconForFile('APP.JS')).toBe(getIconForFile('app.js'));
  });

  it('reads the last extension of a multi-part name', () => {
    expect(getIconForFile('babel.config.js')).toBe('file-type-js-official');
  });

  it('returns default-file for an extension it does not know', () => {
    expect(getIconForFile('report.qqzz')).toBe('default-file');
  });

  it('returns default-file for a name with no extension', () => {
    expect(getIconForFile('somefile')).toBe('default-file');
  });
});

describe('generateIconSVG', () => {
  it('wraps the icon body in a root svg element', () => {
    const svg = generateIconSVG('file-type-python');
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain(getIconSVG('file-type-python'));
  });

  it('carries a viewBox, so a tab can scale it', () => {
    expect(generateIconSVG('file-type-python')).toContain(
      'viewBox="0 0 32 32"'
    );
  });

  it('applies a class name when one is given', () => {
    expect(generateIconSVG('file-type-python', 'jp-icon')).toContain(
      'class="jp-icon"'
    );
  });
});

describe('getIconViewBox', () => {
  // 38 entries in the bundled set are not 32x32. A body written in a
  // 254.5x225 space draws nothing inside a 32x32 window: measured at 16px,
  // file-type-go rendered 0 ink pixels in the assumed box and 104 in its own.
  it('reads the box an icon declares', () => {
    expect(getIconViewBox('file-type-go')).toBe('0 0 254.5 225');
    expect(getIconViewBox('file-type-docusaurus')).toBe('0 0 200 200');
  });

  it('falls back to the collection default', () => {
    expect(getIconViewBox('file-type-python')).toBe('0 0 32 32');
    expect(getIconViewBox('file-type-js-official')).toBe('0 0 32 32');
  });

  it('answers for a name the set does not hold', () => {
    expect(getIconViewBox('file-type-not-a-real-icon')).toBe('0 0 32 32');
  });

  it('is what generateIconSVG puts on the element', () => {
    expect(generateIconSVG('file-type-go')).toContain(
      'viewBox="0 0 254.5 225"'
    );
    expect(generateIconSVG('file-type-python')).toContain(
      'viewBox="0 0 32 32"'
    );
  });
});
