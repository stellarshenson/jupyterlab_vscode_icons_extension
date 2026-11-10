/**
 * The own-file-type claim scan for DEF-ICONS-99-MK-ICON.
 *
 * JupyterLab's `getFileTypesForPath` keeps the first pattern match only, so a
 * foreign type with a broader pattern hides this extension's `Makefile` type
 * from the row painter. `ownTypeForName` scans this extension's types alone.
 */

import { ownTypeForName } from '../own-file-type';

interface IType {
  name: string;
  pattern?: string;
  extensions?: string[];
  icon?: { svgstr?: string };
}

// The type jupyterlab_makefile_file_type_extension registers, pattern first.
const FOREIGN: IType = {
  name: 'makefile',
  pattern:
    '^(Makefile|makefile|GNUmakefile|makefile\\..*|.*\\.(mk|mak|make|makefile))$',
  extensions: ['.mk', '.mak', '.make', '.makefile'],
  icon: { svgstr: '<svg></svg>' }
};

// This extension's type, registered after it.
const OWN: IType = {
  name: 'vscode-makefile',
  pattern: '^(Makefile|makefile|GNUmakefile)$',
  extensions: ['.mk', '.mak', '.make'],
  icon: { svgstr: '<svg></svg>' }
};

// An own type whose icon cannot be painted, registered before a valid one.
const BROKEN_OWN: IType = {
  name: 'vscode-makefile-broken',
  pattern: '^(Makefile|makefile|GNUmakefile)$',
  extensions: ['.mk', '.mak', '.make'],
  icon: {}
};

const isOwn = (type: IType): boolean => type.name !== 'makefile';

describe('ownTypeForName', () => {
  it('finds the own makefile type for Makefile and .mk past a foreign first match', () => {
    expect(ownTypeForName('Makefile', [FOREIGN, OWN], isOwn)).toBe(OWN);
    expect(ownTypeForName('audio8.mk', [FOREIGN, OWN], isOwn)).toBe(OWN);
    expect(ownTypeForName('notes.qqzz', [FOREIGN, OWN], isOwn)).toBeNull();
  });

  it('skips an own claim whose icon has no svgstr', () => {
    expect(ownTypeForName('Makefile', [FOREIGN, BROKEN_OWN, OWN], isOwn)).toBe(
      OWN
    );
    expect(ownTypeForName('Makefile', [BROKEN_OWN], isOwn)).toBeNull();
  });
});
