/**
 * Artwork geometry the maintainer set by hand.
 *
 * These are not derived values - he chose each one by eye and asked for it in
 * words, and each has been lost once already to a revert that could not see the
 * instruction. The numbers are read out of src/index.ts rather than re-typed,
 * so the assertion moves with the artwork and still fails when a value is
 * dropped back to its original.
 */

// `export {}` makes this file a module, so its top-level names are its own.
// Without it TypeScript treats every spec as one global script and `source`
// collides with the identically named read in icon-contrast.spec.ts.
export {};

const source: string = require('fs').readFileSync(
  require('path').join(__dirname, '..', 'index.ts'),
  'utf8'
);

describe('the markdown M', () => {
  // Two earlier ten percent reductions, twenty percent of the remaining height,
  // then ten percent three more times:
  // 1 -> 0.9 -> 0.81 -> 0.648 -> 0.5832 -> 0.52488 -> 0.472392.
  // The transform scales about y=0, so a translate of baseline * (1 - scale)
  // puts the baseline back where it was and the letter loses height from the
  // top only. The M's baseline is the lowest coordinate in its own path data.
  const BASELINE = 189.5437;
  const SCALE = 0.472392;

  const transform = (): { translate: number; scale: number } => {
    const match = source.match(
      /<path fill="#8a2ea5" transform="translate\(0,([0-9.]+)\) scale\(1,([0-9.]+)\)"/
    );
    if (!match) {
      throw new Error('the markdown M no longer carries a scale transform');
    }
    return { translate: Number(match[1]), scale: Number(match[2]) };
  };

  it('is ten percent shorter than the previous 52.488 percent height', () => {
    expect(transform().scale).toBeCloseTo(SCALE, 6);
  });

  it('keeps its baseline where the unscaled letter put it', () => {
    const { translate, scale } = transform();
    expect(scale * BASELINE + translate).toBeCloseTo(BASELINE, 3);
  });

  it('reads that baseline off the path it scales', () => {
    // If the artwork is redrawn, BASELINE above is stale and the assertion
    // that depends on it is measuring nothing. This path writes every y as
    // the half of a comma pair, so the vertical extent is the largest of
    // those; the letter sits on its baseline, which makes that the baseline.
    // The sheet behind the letter carries the same fill, so the match is
    // anchored on the transform: only the M has one.
    const path = source.match(
      /<path fill="#8a2ea5" transform="[^"]*" d="([^"]+)"/
    );
    if (!path) {
      throw new Error('the markdown M path is gone from src/index.ts');
    }
    const ys = (path[1].match(/,\s*-?[0-9.]+/g) || []).map(pair =>
      Number(pair.slice(1))
    );
    expect(ys.length).toBeGreaterThan(0);
    expect(Math.max(...ys)).toBeCloseTo(BASELINE, 4);
  });
});
