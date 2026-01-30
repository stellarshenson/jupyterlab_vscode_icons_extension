/**
 * Hotfix for jupytext 1.19.1 breaking change
 *
 * Jupytext 1.19.1 registers a catch-all file type with pattern
 * `^(?!.*\\.(excludedExtensions)$).*$` that matches ALL files except
 * jupytext's own formats. This overrides icons for standard file types.
 *
 * Solution: Replace the catch-all with a whitelist pattern that ONLY
 * matches files jupytext actually handles. The main extension's CSS and
 * MutationObserver are updated to handle both data-file-type="notebook"
 * and data-file-type="jupytext-notebook-file".
 *
 * Jupytext handles: .py, .md, .Rmd, .qmd, .myst, .mystnb, .mnb
 *
 * Remove this file when jupytext releases a fix.
 *
 * @see https://github.com/mwouts/jupytext/blob/v1.19.1/jupyterlab/packages/jupyterlab-jupytext-extension/src/registry.ts
 */

import { DocumentRegistry } from '@jupyterlab/docregistry';

const JUPYTEXT_1191_STYLE_ID = 'vscode-icons-jupytext-1191-hotfix';

const HOTFIX_CSS = `
/* Reset jupytext 1.19.1 ::after pseudo-element (orange borders on markdown) */
.jp-DirListing-item .jp-DirListing-itemIcon::after {
  content: none !important;
  display: none !important;
  border: none !important;
  outline: none !important;
  background: none !important;
  position: static !important;
  width: 0 !important;
  height: 0 !important;
}

/* Ensure icon container displays normally */
.jp-DirListing-item .jp-DirListing-itemIcon {
  overflow: visible !important;
}

/* Ensure SVG and img icons inside are visible */
.jp-DirListing-item .jp-DirListing-itemIcon > svg,
.jp-DirListing-item .jp-DirListing-itemIcon > img {
  display: inline-block !important;
  visibility: visible !important;
  opacity: 1 !important;
}
`;

// Formats jupytext actually handles (whitelist approach)
// These are the only extensions that should match jupytext's file type
const JUPYTEXT_FORMATS = ['py', 'md', 'Rmd', 'qmd', 'myst', 'mystnb', 'mnb'];

export const applyJupytext1191Hotfix = (
  docRegistry?: DocumentRegistry
): void => {
  // Inject CSS fixes
  if (!document.getElementById(JUPYTEXT_1191_STYLE_ID)) {
    const styleElement = document.createElement('style');
    styleElement.id = JUPYTEXT_1191_STYLE_ID;
    styleElement.textContent = HOTFIX_CSS;
    document.head.appendChild(styleElement);
  }

  // Monkey-patch jupytext's file type by accessing the internal registry
  if (docRegistry) {
    // Access internal file types array (private but accessible)
    const fileTypes = (docRegistry as any)._fileTypes as any[];

    if (fileTypes && Array.isArray(fileTypes)) {
      // Find jupytext's catch-all file type
      const jupytextCatchAll = fileTypes.find(
        (ft: any) => ft.name === 'jupytext-notebook-file'
      );

      if (jupytextCatchAll) {
        // Build whitelist pattern: only match jupytext formats
        const correctedPattern = `^.*\\.(?:${JUPYTEXT_FORMATS.join('|')})$`;

        // Monkey-patch the pattern
        jupytextCatchAll.pattern = correctedPattern;
      }
    }
  }
};

export const removeJupytext1191Hotfix = (): void => {
  const styleElement = document.getElementById(JUPYTEXT_1191_STYLE_ID);
  if (styleElement) {
    styleElement.remove();
  }
};
