/**
 * Decide which JupyterLab icon a document tab may mirror from its file type.
 *
 * A file editor tab carries JupyterLab's generic text-editor glyph, so the
 * tab painter would otherwise fall through to this extension's bundled
 * artwork while the file browser row shows a JupyterLab icon (DEF-TABS-79).
 * Copying the icon's svgstr into a data URI drops the class that themes it
 * (DEF-TABS-19), so the caller wears the icon object itself through
 * widget.title.icon.
 */

export interface IMirrorCandidate {
  readonly name: string;
  readonly contentType: string;
  readonly icon?: { readonly name?: string } | null;
}

/**
 * Return the icon object to mirror for an ordered file-type list, or null.
 *
 * - default and text are placeholders, not claims, and are skipped.
 * - Types without an icon object are skipped.
 * - The first type that carries an icon object decides; the scan never
 *   continues past it, because the registry order is what the row uses.
 * - Only a JupyterLab-owned icon outside the two generic glyphs qualifies;
 *   another extension's icon must keep winning (ACC-TABS-31).
 * - Only a file content type qualifies; a notebook's own tab icon is
 *   already specific and is not mirrored.
 */
export function mirrorIconForTypes<T extends IMirrorCandidate>(
  types: ReadonlyArray<T>
): NonNullable<T['icon']> | null {
  for (const type of types) {
    if (type.name === 'default' || type.name === 'text') {
      continue;
    }
    const icon = type.icon;
    if (!icon || typeof icon !== 'object') {
      continue;
    }
    const name = icon.name || '';
    if (!name.startsWith('ui-components:')) {
      return null;
    }
    if (name === 'ui-components:file' || name === 'ui-components:text-editor') {
      return null;
    }
    return type.contentType === 'file'
      ? (icon as NonNullable<T['icon']>)
      : null;
  }
  return null;
}
