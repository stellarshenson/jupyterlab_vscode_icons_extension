/**
 * Tab tooltip lines - ACC-TABS-63, ACC-TABS-64, ACC-TABS-65, ACC-TABS-68.
 */

import { tabTooltipLines } from '../tab-tooltip';

describe('tabTooltipLines', () => {
  it('gives the label alone when there is no location or activity', () => {
    expect(tabTooltipLines('Bramka 84th batch', '', undefined)).toEqual([
      'Bramka 84th batch'
    ]);
  });

  it('adds the path below the label', () => {
    expect(tabTooltipLines('notes.md', 'work/notes.md', undefined)).toEqual([
      'notes.md',
      'work/notes.md'
    ]);
  });

  it('leaves out a location that repeats the label', () => {
    expect(tabTooltipLines('notes.md', 'notes.md', undefined)).toEqual([
      'notes.md'
    ]);
  });

  it('ends with the last activity as time ago', () => {
    const lines = tabTooltipLines(
      'page',
      'http://localhost:8888/proxy/1/',
      Date.now() - 5 * 60 * 1000
    );
    expect(lines).toHaveLength(3);
    expect(lines[2]).toMatch(/^Last activity: 5 minutes ago$/);
  });

  it('adds the caption lines that do not repeat the label or the path', () => {
    expect(
      tabTooltipLines(
        'notes.md',
        'work/notes.md',
        undefined,
        'Name: notes.md\nPath: work/notes.md\nLast Saved: 23/10/2026, 10:34\nLast Checkpoint: None'
      )
    ).toEqual([
      'notes.md',
      'work/notes.md',
      'Last Saved: 23/10/2026, 10:34',
      'Last Checkpoint: None'
    ]);
  });
});
