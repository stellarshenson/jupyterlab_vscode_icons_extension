# Changelog

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
