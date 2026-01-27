# Jupytext 1.19.1 Hotfix

This document describes the hotfix implemented to address a breaking change in jupytext 1.19.1 that affects file icons in JupyterLab.

## Problem

Jupytext 1.19.1 introduced a catch-all file type registration in `registry.ts` that overrides icons for standard file types:

```typescript
docRegistry.addFileType({
  name: 'jupytext-notebook-file',
  contentType: 'notebook',
  pattern: `^(?!.*\\.(${excludedExtensions})$).*$`,
  icon: fileIcon,
});
```

The `excludedExtensions` list only includes:
- ipynb
- myst, mystnb, mnb
- Rmd
- qmd
- Jupytext-specific format extensions

Standard file types like `.yml`, `.json`, `.png`, `.zip`, `.js`, etc. are NOT excluded, causing their icons to be replaced with the generic file icon.

## Solution

The hotfix in `src/hotfixes/jupytext-1.19.1.ts` monkey-patches jupytext's file type registration by:

1. Accessing JupyterLab's internal `docRegistry._fileTypes` array
2. Finding the `jupytext-notebook-file` entry
3. Replacing its pattern with a corrected version that excludes ~90 known file extensions

Additionally, CSS is injected to reset the `::after` pseudo-element that jupytext uses to add orange borders to markdown files.

## Affected Extensions

The hotfix protects the following file extensions from jupytext's catch-all:

**Images**: jpg, jpeg, png, gif, bmp, svg, webp, ico, tiff, tif

**Data**: json, yaml, yml, xml, csv, tsv

**Web**: html, htm, css

**Archives**: zip, tar, gz, bz2, xz, 7z, rar

**Documents**: pdf, doc, docx, xls, xlsx, xlsm, ppt, pptx, odt, ods, odp

**Programming**: js, mjs, cjs, ts, mts, cts, jsx, tsx, java, c, cpp, h, hpp, cs, go, rs, rb, php, swift, kt, scala, pl, pm, lua, sh, bash, zsh, fish, csh, nu, bat, cmd, ps1

**Config**: toml, ini, cfg, conf, env, lock, tf, tfvars

**Text**: txt, log, rst, tex

## Removal Instructions

When jupytext releases a fix (check releases at https://github.com/mwouts/jupytext/releases):

1. Delete `src/hotfixes/jupytext-1.19.1.ts`
2. Update `src/hotfixes/index.ts` to remove the export (or delete if no other hotfixes)
3. Remove the import and `applyJupytext1191Hotfix(docRegistry)` call from `src/index.ts`
4. Delete this documentation file

## References

- Jupytext 1.19.1 registry.ts: https://github.com/mwouts/jupytext/blob/v1.19.1/jupyterlab/packages/jupyterlab-jupytext-extension/src/registry.ts
- Issue introduced in commit that added catch-all file type for icon handling
