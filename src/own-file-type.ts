/**
 * Find this extension's own file type for a file name.
 *
 * JupyterLab's `getFileTypesForPath` keeps only the first pattern match, so a
 * type another extension registered with a wider pattern earlier in the
 * registry hides this extension's type for that name - `Makefile` while the
 * makefile-file-type extension is installed (DEF-ICONS-99). This scan applies
 * the registry's own two rules, pattern against the basename and extension
 * against every compound suffix, to this extension's types alone.
 */

export interface IClaimingFileType {
  readonly name: string;
  readonly pattern?: string | RegExp | null;
  readonly extensions?: ReadonlyArray<string> | null;
  readonly icon?: { readonly svgstr?: string } | null;
}

/**
 * Return the first type `isOwn` accepts that claims `name` and carries a
 * usable icon, or null.
 *
 * The list is scanned in registry order, so the first such own claim wins just
 * as `getFileTypesForPath` ranks types. A claim whose icon has no `svgstr` is
 * skipped: it could not be painted, and returning it would hide a later own
 * type registered for the same name. `name` is the file name, not a path.
 */
export function ownTypeForName<T extends IClaimingFileType>(
  name: string,
  types: ReadonlyArray<T>,
  isOwn: (type: T) => boolean
): T | null {
  // The registry's Private.extname: everything from the first dot, then one
  // shorter suffix per dot, so `audio8.mk` gives `.mk` and `x.tar.gz` gives
  // `.tar.gz` then `.gz`.
  const suffixes: string[] = [];
  const parts = name.split('.');
  for (let i = 1; i < parts.length; i++) {
    suffixes.push('.' + parts.slice(i).join('.').toLowerCase());
  }
  for (const type of types) {
    if (!isOwn(type) || !type.icon?.svgstr) {
      continue;
    }
    if (type.pattern && name.match(type.pattern) !== null) {
      return type;
    }
    const extensions = (type.extensions || []).map(ext => ext.toLowerCase());
    if (suffixes.some(suffix => extensions.includes(suffix))) {
      return type;
    }
  }
  return null;
}
