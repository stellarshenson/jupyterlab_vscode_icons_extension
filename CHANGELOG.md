# Changelog

## 1.1.108 (2026-08-09)

### Enhancements

- Database icon is now a 3-slice cylinder instead of 4, and noticeably shorter (77% of the previous height, same width)
- Lightened the database blue from `#4a86c5` to `#5890ca`, which still clears the 3:1 contrast bar on both light (3.36:1) and dark (4.80:1) themes so no light-theme variant is needed

## 1.1.107 (2026-08-09)

### Maintenance

- Upgraded the build Makefile from template 1.31 to 1.37 - it now creates a project-local `.nodeenv/` instead of overwriting the Python prefix's node, fixing a `Text file busy` build failure when the node binary is held open by another process
- Pinned the build toolchain to node 24.19.0 through the project-local nodeenv
- Added `.nodeenv/` to `.gitignore`

No functional change to the extension itself - build tooling only.

## 1.1.106 (2026-08-09)

### Enhancements

- Unified database icons - `.db`, `.db3`, `.sqlite` and `.sqlite3` now share a single blue cylinder instead of a separate SQLite brand logo and grey cylinder
- Recoloured the cylinder to `#4a86c5`, which clears the 3:1 contrast bar on both light (3.81:1) and dark (4.22:1) themes

### Maintenance

- Removed the light-theme database icon variant and its `body[data-jp-theme-light]` swap, no longer needed now that one colour works on both themes

## 1.1.105 (2026-08-08)

### Features

- Added database file icons for `.db`, `.db3`, `.sqlite` and `.sqlite3`
- `.sqlite`/`.sqlite3` use the SQLite brand logo; `.db`/`.db3` use the generic database cylinder, since `.db` is an overloaded extension
- Database cylinder is theme-aware - `file-type-db` on dark themes, `file-type-light-db` on light themes

### Bug Fixes

- Cleared the icon container's own `background-image` so file types registered by other extensions via `iconClass` (such as `jupyterlab_tabular_data_viewer_extension`) no longer show through beneath the overridden icon
- Corrected the `enableDataIcons` setting description, which advertised YAML and database coverage that the setting does not gate

## 1.1.49 (2025-01-27)

### Features

- Added hotfix for jupytext 1.19.1 catch-all pattern bug that breaks standard file icons
- Created `src/hotfixes/` module architecture for isolated third-party fixes
- Monkey-patches jupytext's `jupytext-notebook-file` file type to exclude ~90 known extensions
- Includes CSS reset for jupytext's orange borders on markdown files

### Documentation

- Added `docs/jupytext-1.19.1-hotfix.md` with problem analysis and removal instructions
- Updated README.md with jupytext 1.19.1 hotfix note

### Maintenance

- Updated `tsconfig.json` include pattern from `src/*` to `src/**/*` for subdirectories

## 1.0.62 (2025-01-14)

### Bug Fixes

- Fixed icon color swapping issue where JavaScript, PNG, and TOML files incorrectly displayed shell script orange filter
- Changed CSS selectors to require both `data-file-type="vscode-file-type-shell"` AND `data-shell-type` attributes
- Refactored `markSpecialFiles()` function to actively remove incorrect attributes from non-matching files
- Prevents race conditions where DOM element reuse causes attribute persistence after file type changes

## 1.0.37 (2025-01-13) - STABLE

### Enhancements

- Fine-tuned README.md icon boldness with font size 20px and stroke-width 0.7px for optimal visual balance

## 1.0.36 (2025-01-13)

### Enhancements

- Reduced README.md icon boldness (font size 21px, stroke-width 1px)

## 1.0.35 (2025-01-13)

### Enhancements

- Increased README.md icon boldness with larger font size (22px) and stroke-width (1.5px)

## 1.0.34 (2025-01-13)

### Enhancements

- Enlarged README.md icon circle (radius 14px) and increased "i" font size to 20px

## 1.0.33 (2025-01-13)

### Enhancements

- Increased README.md icon stroke width for enhanced boldness

## 1.0.32 (2025-01-13)

### Enhancements

- Enlarged README.md icon to 20px
- Made "i" transparent using SVG mask cutout technique
- Changed font to Courier New monospace

## 1.0.31 (2025-01-13)

### Features

- Added custom README.md icon with purple filled circle (#9826c8) and white bold lowercase "i"
- Applied consistent purple color scheme to both CLAUDE.md and README.md icons

## 1.0.30 (2025-01-13) - STABLE

### Features

- Implemented CLAUDE.md icon override using CSS and MutationObserver
- Added purple tint to CLAUDE.md icon using CSS filters

### Enhancements

- Unified shell icons - .bat/.cmd now use same icon as .sh/.bash/.zsh files
- Applied color differentiation - pale red for Linux shells, pale blue for Windows shells
- Inverted and desaturated .sh icon colors for better visual distinction

### Bug Fixes

- Fixed CLAUDE.md pattern matching by implementing CSS-based override to work with Jupytext server-side file type detection

### Tests

- Updated extension load test to check docRegistry instead of console messages

## 1.0.29 (2025-01-13)

### Features

- Added CLAUDE.md file icon support with Claude branding

### Maintenance

- Removed debug console.log statements from production code
- Added repository URLs to package.json for GitHub Actions compatibility
- Fixed CSS selector specificity order

## 1.0.28 (2025-01-13) - STABLE

### Features

- Added shell script icon colorization - pale red for Linux shells (.sh, .bash, .zsh), pale blue for Windows shells (.bat, .cmd, .ps1)

## 1.0.26 (2025-01-13)

### Features

- Added comprehensive badge set to README (GitHub Actions, npm version, PyPI version, PyPI downloads, JupyterLab 4 compatibility)

### Maintenance

- Updated GitHub Actions workflows based on reference repository
- Added link checker ignore patterns for badge URLs
- Applied code formatting with Prettier and ESLint
- Renamed TypeScript interfaces to follow conventions (IIconSettings, IFileTypeConfig)

## 1.0.25 (2025-01-13)

### Features

- Updated Jupytext markdown file icon override to use JupyterLab native markdown icon instead of VSCode icon

## 1.0.21 (2025-01-13)

### Features

- Implemented Jupytext Python file icon override using CSS injection and MutationObserver
- Added DOM-based icon override for .py files shown as notebooks by Jupytext

## 1.0.20 (2025-01-13)

### Features

- Implemented settings change alert debouncing (500ms) to prevent multiple popups when resetting all settings

## 1.0.19 (2025-01-13)

### Bug Fixes

- Fixed settings schema 404 error by adding schemaDir configuration to package.json

## Earlier Versions

Initial development and feature implementation including VSCode icon integration, settings system, LICENSE custom icon, and basic file type support.
