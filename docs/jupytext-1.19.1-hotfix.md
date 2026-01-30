# Jupytext 1.19.1 Hotfix

This document describes the hotfix implemented to address a breaking change in jupytext 1.19.1 that affects file icons in JupyterLab.

## Problem

Jupytext 1.19.1 introduced a catch-all file type registration with a negative lookahead pattern:

```typescript
docRegistry.addFileType({
  name: 'jupytext-notebook-file',
  contentType: 'notebook',
  pattern: `^(?!.*\\.(${excludedExtensions})$).*$`,
  icon: fileIcon
});
```

The `excludedExtensions` list only includes jupytext's own formats (ipynb, myst, mystnb, mnb, Rmd, qmd). Standard file types like `.yml`, `.json`, `.png`, `.zip`, `.js` are NOT excluded, causing their icons to be replaced with the generic file icon.

## Solution

The hotfix uses a **whitelist approach** - we replace the catch-all pattern with one that only matches the 7 formats jupytext actually handles:

```typescript
const JUPYTEXT_FORMATS = ['py', 'md', 'Rmd', 'qmd', 'myst', 'mystnb', 'mnb'];
const correctedPattern = `^.*\\.(?:${JUPYTEXT_FORMATS.join('|')})$`;
```

**Benefits**:
- 7 extensions to maintain instead of 120+
- New file types automatically get correct icons
- Future-proof without manual updates

### Supporting Changes

The whitelist causes `.py` and `.md` files to get `data-file-type="jupytext-notebook-file"` instead of `data-file-type="notebook"`. To handle this:

1. **CSS selectors** use `[data-file-type*="notebook"]` to match both values
2. **JavaScript** in `markSpecialFiles()` checks for both `fileType === 'notebook'` and `fileType === 'jupytext-notebook-file'`

## CSS Fixes

The hotfix also injects CSS to reset the `::after` pseudo-element that jupytext uses to add orange borders to markdown files.

## Removal Instructions

When jupytext releases a fix (check releases at https://github.com/mwouts/jupytext/releases):

1. Delete `src/hotfixes/jupytext-1.19.1.ts`
2. Update `src/hotfixes/index.ts` to remove the export (or delete if no other hotfixes)
3. Remove the import and `applyJupytext1191Hotfix(docRegistry)` call from `src/index.ts`
4. Revert CSS selectors from `[data-file-type*="notebook"]` back to `[data-file-type="notebook"]`
5. Revert JavaScript check from `fileType === 'notebook' || fileType === 'jupytext-notebook-file'` to just `fileType === 'notebook'`
6. Delete this documentation file

## References

- Jupytext 1.19.1 registry.ts: https://github.com/mwouts/jupytext/blob/v1.19.1/jupyterlab/packages/jupyterlab-jupytext-extension/src/registry.ts
