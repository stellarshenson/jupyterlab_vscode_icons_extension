# Changelog

## [1.2.11] - 2026-10-18

### Changed

- Tab icons are slightly smaller, fitting a 13px content box inside the 16px host and keeping their aspect ratio without clipping
- A tab icon that cannot clear 3:1 against its tab background is recoloured in one shared mix that keeps its internal colours distinct, instead of being outlined

### Fixed

- A tab icon's transparent cutouts no longer fill with the outline colour, so the Makefile cogs stay transparent on inactive dark tabs and custom themes

## [1.2.10] - 2026-10-18

### Fixed

- The log-file icon turns white on a selected row, so it no longer disappears into the selection band

## [1.2.9] - 2026-10-17

### Changed

- The C++ hexagon draws one plus inside the C's counter and the second at the mouth, so the pair no longer presses against the hexagon's right edge

## [1.2.8] - 2026-10-17

### Added

- C, C header, C++, C++ header and Objective-C++ files use matching hexagon icons, and C++ draws a larger `++`; Rust files use the same hexagon with the Rust gear
- C# files use the green C# hexagon, and CUDA and Java files use hexagon icons with the NVIDIA eye and the white letter J; `.hh`, `.hxx`, `.h++`, `.cu`, `.cuh` and `.mm` are now mapped

### Fixed

- A dot-named symbolic link, such as `.cache`, is dimmed like every other hidden file; its link badge is dimmed with the row

## 1.2.7 (2026-10-16)

### Bug Fixes

- A folder without `pyproject.toml` or `setup.py` no longer requests them, so the browser console no longer fills with 404 errors on every refresh and every 10 s poll
- While a package folder stays open, its manifests are read again only when one of them changes or a read in that folder fails, instead of up to six times on every refresh and every poll
- Large folders open about as fast as without the extension: a 1,000-file folder took 14.4 s and now takes 1.5 s, and a 5,000-file folder no longer freezes the tab
- The Python package glyph no longer disappears for 100 ms each time the listing changes
- A manifest read that fails is retried on the next pass, so one failed request does not hide the package glyph

### Tests

- Galata tests count the manifest requests per folder and the row passes while a 1,000-file folder opens
- The Galata test server lists and creates dot-named files on any machine, so the dotfile tests no longer pass locally and fail in CI
- CI runs the Galata suite against the built wheel for both the browser and the server code, and checks that the installed wheel registers its server extension

## 1.2.6 (2026-10-16)

### Enhancements

- Symbolic link rows carry a small square badge drawn inside the icon canvas, and the link state arrives with the directory listing, so a badge costs no extra server request
- A dot-named symbolic link keeps its row's full opacity, so the badge stays legible on the dimmed hidden-file row
- Executable badges (opt-in in the settings) arrive with the listing too, so they paint on the first frame instead of after a server round trip
- A PDF file shows the same artwork on its browser row and its document tab

### Bug Fixes

- A file type another extension has claimed keeps that extension's icon
- The Python-package check reads `pyproject.toml` and `setup.py` directly, so the file browser's name filter no longer empties the package glyphs
- Manifest validation is cached per manifest revision, ending the repeated checks while the file browser polls
- A subdirectory entry no longer costs a thread-pool hop while a directory is listed
- A malformed manifest no longer marks package folders

### Tests

- The Galata browser suite runs against the repository build instead of the last installed package, so a green run tests the working tree

## 1.2.2 (2026-10-14)

### Enhancements

- `.bpmn` files now take this extension's own process mark on file browser rows and on document tabs, ahead of the Camunda modeller extension's icon where that extension is installed
- The BPMN mark is redrawn: a square tile in a paler orange, carrying a start event, a task and an end event joined by sequence flows
- Document tab icons are padded to the same 16px box JupyterLab gives its own, so a painted tab glyph no longer sits 2px short of a stock one
- `requirements.txt` shows the Python glyph on its row as well as its tab, instead of the generic text sheet on one and Python on the other
- The letter in the Markdown icon is shorter, leaving more of the sheet visible around it
- Shell script and joblib icons carry their colours in the artwork, so a tab icon matches its file browser row instead of rendering black
- Glyphs that cannot be seen against the panel they sit on get a thin outline, on file browser rows as well as tabs, and the outline now follows a theme switch

### Bug Fixes

- Icons whose artwork is not 32x32 render again - `file-type-go` drew nothing at all, because every icon was scaled as if it shared one viewBox
- Renaming an open file updates its icon; the old name's glyph used to stay until the listing changed
- A file browser row reused for another file drops the previous file's artwork on the first frame rather than after two server round-trips
- The joblib mark no longer loses part of itself on a selected row, where one of its two inked paths kept a colour that measures 1.22:1 against the selection band
- Switching the theme no longer leaves outline markers decided by the previous theme

### Maintenance

- Four `@jupyterlab` packages the source imports are now declared dependencies rather than relying on hoisting
- Added a contrast module with unit tests, and acceptance criteria and defect trackers under `docs/`

## 1.1.110 (2026-10-14)

### Bug Fixes

- eslint and stylelint now actually run before a release - `jlpm test` was `jest --coverage` alone, so the eslint 9 flat config this release adopts would have gated nothing, on the maintainer's machine and in CI alike
- Restored the author association gate on the snapshot workflow, which the template update had removed; without it any GitHub user could run code in this repository by commenting the trigger phrase
- `RELEASE.md` no longer documents a manual `hatch version` / `twine upload` path that contradicts `make publish` and would fork the two registries

### Maintenance

- Upgraded the build Makefile from template 1.37 to 1.45: `increment_version` moved off `build` and onto `install`, so a build no longer consumes a version, and `publish` now runs the test suite and commits the version metadata before writing to either registry
- Updated the copier project template from `jupyterlab/extension-template` v4.5.0 to v4.6.5: build backend moved from `jupyterlab` to `jupyter-builder`, eslint 8 replaced by an eslint 9 flat config, `@jupyterlab/builder` replaced by `@jupyter/builder`, `requires-python` raised to 3.10, `CONTRIBUTING.md` added and `setup.py` removed
- Refreshed the npm toolchain within the declared ranges and kept TypeScript at 5.8 rather than the template's 5.5
- Added acceptance criteria and defect trackers under `docs/`, written through `pm-tools`

No functional change to the extension itself - build tooling and documentation only.

## 1.1.109 (2026-08-22)

### Bug Fixes

- Database icon no longer disappears into the file browser's selection highlight - it now turns white when its row is selected, matching what JupyterLab does to its own icons
- The blue cylinder measured 1.07:1 against the selection band (`--jp-brand-color1`); the white variant measures 3.12:1 on dark and 4.60:1 on light

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
