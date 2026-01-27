/**
 * Hotfix for jupytext 1.19.1 breaking change
 *
 * Jupytext 1.19.1 registers a catch-all file type with pattern
 * `^(?!.*\\.(excludedExtensions)$).*$` that overrides icons for ALL
 * standard file types (yml, js, png, zip, etc.) because they forgot
 * to exclude them.
 *
 * This hotfix monkey-patches jupytext's file type registration by
 * modifying its pattern to exclude standard file extensions.
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

// Extensions that should NOT be caught by jupytext's catch-all
const KNOWN_EXTENSIONS = [
  // Images
  'jpg',
  'jpeg',
  'png',
  'gif',
  'bmp',
  'svg',
  'webp',
  'ico',
  'tiff',
  'tif',
  // Data
  'json',
  'yaml',
  'yml',
  'xml',
  'csv',
  'tsv',
  // Web
  'html',
  'htm',
  'css',
  // Archives
  'zip',
  'tar',
  'gz',
  'bz2',
  'xz',
  '7z',
  'rar',
  // Documents
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'xlsm',
  'ppt',
  'pptx',
  'odt',
  'ods',
  'odp',
  // Programming (not handled by jupytext)
  'js',
  'mjs',
  'cjs',
  'ts',
  'mts',
  'cts',
  'jsx',
  'tsx',
  'java',
  'c',
  'cpp',
  'h',
  'hpp',
  'cs',
  'go',
  'rs',
  'rb',
  'php',
  'swift',
  'kt',
  'scala',
  'pl',
  'pm',
  'lua',
  'sh',
  'bash',
  'zsh',
  'fish',
  'csh',
  'nu',
  'bat',
  'cmd',
  'ps1',
  // Config
  'toml',
  'ini',
  'cfg',
  'conf',
  'env',
  'lock',
  'tf',
  'tfvars',
  // Text/Docs
  'txt',
  'log',
  'rst',
  'tex',
  // Notebooks (handled separately by jupytext)
  'ipynb'
];

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
        // Build corrected pattern that excludes known extensions
        const extPattern = KNOWN_EXTENSIONS.join('|');
        const correctedPattern = `^(?!.*\\.(${extPattern})$).*$`;

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
