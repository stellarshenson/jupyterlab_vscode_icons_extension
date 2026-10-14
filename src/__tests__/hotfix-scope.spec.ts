/**
 * jupytext 1.19.1 hotfix scope - ACC-HOTFIX-19.
 *
 * The hotfix reaches into the document registry's private file-type array and
 * rewrites one entry. Everything about that is risky, so the test that matters
 * is the blast radius: exactly one file type changes, and the replacement
 * pattern matches what jupytext handles and nothing else.
 */

import { applyJupytext1191Hotfix } from '../hotfixes';

type FileType = { name: string; pattern?: string; extensions?: string[] };

const registryWith = (fileTypes: FileType[]): any => ({
  _fileTypes: fileTypes
});

const CATCH_ALL = '^(?!.*\\.(ipynb)$).*$';

const fixture = (): FileType[] => [
  { name: 'notebook', extensions: ['.ipynb'] },
  { name: 'jupytext-notebook-file', pattern: CATCH_ALL },
  { name: 'vscode-file-type-js-official', extensions: ['.js'] },
  { name: 'markdown', extensions: ['.md'] }
];

describe('applyJupytext1191Hotfix', () => {
  it('changes the jupytext file type and nothing else', () => {
    const fileTypes = fixture();
    const before = JSON.parse(JSON.stringify(fileTypes));
    applyJupytext1191Hotfix(registryWith(fileTypes));

    const changed = fileTypes.filter(
      (ft, i) => JSON.stringify(ft) !== JSON.stringify(before[i])
    );
    expect(changed.map(ft => ft.name)).toEqual(['jupytext-notebook-file']);
  });

  it('replaces the catch-all with jupytext own formats', () => {
    const fileTypes = fixture();
    applyJupytext1191Hotfix(registryWith(fileTypes));
    const jupytext = fileTypes.find(
      ft => ft.name === 'jupytext-notebook-file'
    )!;
    expect(jupytext.pattern).not.toBe(CATCH_ALL);

    const matcher = new RegExp(jupytext.pattern!);
    for (const name of ['script.py', 'notes.md', 'paper.Rmd', 'doc.qmd']) {
      expect([name, matcher.test(name)]).toEqual([name, true]);
    }
    for (const name of ['app.js', 'data.csv', 'image.png', 'styles.css']) {
      expect([name, matcher.test(name)]).toEqual([name, false]);
    }
  });

  it('leaves a registry without the jupytext file type alone', () => {
    const fileTypes = fixture().filter(
      ft => ft.name !== 'jupytext-notebook-file'
    );
    const before = JSON.parse(JSON.stringify(fileTypes));
    applyJupytext1191Hotfix(registryWith(fileTypes));
    expect(fileTypes).toEqual(before);
  });

  it('survives being called with no registry at all', () => {
    expect(() => applyJupytext1191Hotfix()).not.toThrow();
  });
});
