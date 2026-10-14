# Acceptance Criteria - jupyterlab_vscode_icons_extension

What the extension must do: paint vscode-icons glyphs in the JupyterLab file browser, gate them by settings group, and hold its icons against other extensions that claim the same file types. Criteria cover the frontend behaviour and the build and release tooling that ships it.

## Authors

- `@kj` Konrad Jelen

## Icon coverage `ICONS`

Which file gets which vscode-icons glyph in the file browser

- [ ] `ACC-ICONS-1` **Mapped extensions render** - CRITICAL; a file whose extension is in the bundled map renders its vscode-icons glyph in the file browser, not JupyterLab's default icon
  - test: open a directory holding one file per mapped extension, compare each rendered icon against src/icons.ts
  - test-tags: MANUAL
  - log: 2026-10-13T21:24:10Z @kj added
- [ ] `ACC-ICONS-2` **CLAUDE.md and README.md icons** - HIGH; `CLAUDE.md` and `README.md` show their own custom icons, never the generic markdown icon
  - test: create both files in one directory, assert the two icons differ from the .md icon
  - test-tags: MANUAL
  - log: 2026-10-13T21:24:10Z @kj added
- [ ] `ACC-ICONS-3` **Edge: unmapped extension** - MEDIUM; a file whose extension is not in the map keeps JupyterLab's own icon; no blank space and no fallback glyph
  - test: create a file with an invented extension, assert the stock icon renders
  - test-tags: MANUAL
  - log: 2026-10-13T21:24:10Z @kj added
- [ ] `ACC-ICONS-4` **Icons survive row reuse** - HIGH; a file browser row that virtual scrolling reuses for a different file shows the new file's icon, never the previous one's
  - test: scroll a directory of 200 mixed files to the bottom and back, assert every icon matches its row
  - test-tags: MANUAL
  - log: 2026-10-13T21:24:11Z @kj added

## Settings and icon groups `CONFIG`

The seven settings toggles that gate which icon groups paint

- [ ] `ACC-CONFIG-5` **Group toggle defaults** - HIGH; enableLanguageIcons, enableWebIcons, enableDataIcons, enableConfigIcons, enableDocIcons and enableImageIcons default to true; enableExecutableIcons defaults to false
  - test: read schema/plugin.json defaults, assert the six are true and executable is false
  - test-tags: UNIT
  - log: 2026-10-13T21:24:11Z @kj added
- [ ] `ACC-CONFIG-6` **Turning a group off** - HIGH; a group toggled off restores JupyterLab's own icons for that group after a page refresh
  - test: turn enableImageIcons off, refresh, assert a .png row shows the stock icon
  - test-tags: MANUAL
  - log: 2026-10-13T21:24:11Z @kj added
- [ ] `ACC-CONFIG-7` **One alert per settings burst** - MEDIUM; changing several settings at once shows one refresh alert, not one per setting; the debounce is 500 ms
  - test: reset all settings in the settings editor, count the alerts
  - test-tags: MANUAL
  - log: 2026-10-13T21:24:11Z @kj added
- [ ] `ACC-CONFIG-8` **Activates without a settings registry** - MEDIUM; ISettingRegistry is optional, so the plugin activates and paints the default icon set when it is absent
  - test: activate the plugin with ISettingRegistry undefined, assert no throw and icons still paint
  - test-tags: UNIT
  - log: 2026-10-13T21:24:11Z @kj added

## Competing file-type claims `CLASH`

Holding this extension's icons against other extensions that claim the same file types

- [ ] `ACC-CLASH-9` **Override beats another extension's claim** - HIGH; a file type another extension claims through iconClass still shows this extension's icon, painted as a ::before background-image on the icon container
  - test: install jupyterlab_tabular_data_viewer_extension, assert a .csv row keeps the vscode-icons glyph
  - test-tags: MANUAL
  - mechanism: 2026-10-13T21:24:26Z @kj a MutationObserver stamps data-vscode-<type> on the row and injected CSS paints a ::before background-image, which outranks the iconClass svg
  - log: 2026-10-13T21:24:26Z @kj added
- [ ] `ACC-CLASH-10` **Claimed icon does not show through** - HIGH; the icon container's own background-image is cleared, so the other extension's icon never shows beneath the override
  - test: with a competing extension installed, inspect the icon container and assert its background-image is none
  - test-tags: MANUAL
  - log: 2026-10-13T21:24:27Z @kj added
- [ ] `ACC-CLASH-11` **Override re-applies on browser change** - MEDIUM; the observer re-marks items on every file browser mutation, debounced, so navigation and refresh keep the overrides
  - test: navigate between two directories ten times, assert the overridden icons hold
  - test-tags: MANUAL
  - log: 2026-10-13T21:24:27Z @kj added

## Icon colour and contrast `COLOUR`

Icon colours, theme variants and contrast against the backgrounds the icons sit on

- [ ] `ACC-COLOUR-12` **3:1 contrast on both themes** - HIGH; every icon colour the extension sets itself clears 3:1 contrast against the light and the dark theme background
  - test: compute relative-luminance contrast for each hardcoded colour against both theme backgrounds
  - test-tags: MANUAL
  - log: 2026-10-13T21:24:27Z @kj added
- [x] `ACC-COLOUR-13` **Database icon on a selected row** - HIGH; the database icon turns white on a selected file browser row instead of blending into --jp-brand-color1
  - evidence: white variant inspected live in the running lab via Playwright; 3.12:1 against #2196f3 dark and 4.60:1 against #1976d2 light
  - test: select a .db row on the dark theme, assert the cylinder is visible against the highlight
  - test-tags: MANUAL
  - mechanism: 2026-10-13T21:24:27Z @kj a second data URI recolours dbSvg to white at runtime and one rule scoped to .jp-mod-selected swaps the background-image; JupyterLab's own .jp-icon-selectable fill rule cannot reach a background-image
  - log: 2026-10-13T21:24:27Z @kj added
  - log: 2026-10-13T21:24:59Z @kj closed: shipped in v1.1.109
- [ ] `ACC-COLOUR-14` **Shell colour by platform** - MEDIUM; .sh, .bash and .zsh render pale red; .bat, .cmd and .ps1 render pale blue
  - test: put all six in one directory, assert the two colour groups differ
  - test-tags: MANUAL
  - log: 2026-10-13T21:24:27Z @kj added
- [ ] `ACC-COLOUR-15` **Edge: non-shell file carries no shell colour** - MEDIUM; a file that is not a shell script never carries data-shell-type, so the shell colour filter never reaches it
  - test: scroll .js, .png and .toml rows past shell rows, assert none takes the orange filter
  - test-tags: MANUAL
  - log: 2026-10-13T21:24:27Z @kj added

## Python package folders `PYPKG`

Marking folders that a python manifest declares as packages

- [ ] `ACC-PYPKG-16` **Declared package folder** - MEDIUM; a folder declared as a package in pyproject.toml or setup.py shows the Python package icon instead of the plain folder icon
  - test: parsePyprojectToml and parseSetupPy over a manifest declaring two packages, assert both names come back
  - test-tags: UNIT, MANUAL
  - log: 2026-10-13T21:24:45Z @kj added
- [ ] `ACC-PYPKG-17` **Edge: unreadable manifest** - MEDIUM; a malformed or absent pyproject.toml and setup.py leave every folder with its normal icon and raise nothing to the user
  - test: parse a truncated pyproject.toml, assert an empty set and no throw
  - test-tags: UNIT
  - log: 2026-10-13T21:24:45Z @kj added

## Third-party hotfixes `HOTFIX`

Working around defects in other installed extensions, jupytext first

- [ ] `ACC-HOTFIX-18` **jupytext 1.19.1 catch-all** - HIGH; with jupytext 1.19.1 installed, .py and .md files keep their own icons instead of the notebook icon its catch-all file type forces
  - test: install jupytext 1.19.1, assert a .py row shows the python icon
  - test-tags: MANUAL
  - log: 2026-10-13T21:24:45Z @kj added
- [ ] `ACC-HOTFIX-19` **Hotfix scope** - MEDIUM; the hotfix excludes its known extension list from jupytext's jupytext-notebook-file type and changes nothing else in the document registry
  - test: snapshot the docRegistry file types before and after the hotfix, assert only that one changed
  - test-tags: UNIT
  - log: 2026-10-13T21:24:45Z @kj added
- [ ] `ACC-HOTFIX-20` **jupytext markdown border** - MEDIUM; jupytext's orange border on markdown file rows is reset
  - test: with jupytext installed, inspect a .md row and assert no orange border
  - test-tags: MANUAL
  - log: 2026-10-13T21:24:45Z @kj added

## Build and release tooling `BUILD`

What the shared Makefile template and the CI workflows must guarantee about a release

- [ ] `ACC-BUILD-21` **Version moves once per release** - CRITICAL; `make publish` raises the patch version exactly once, and the version in package.json, the wheel and the npm tarball agree
  - test: record the version, run a release, assert each of the three carries old+1
  - test-tags: MANUAL
  - log: 2026-10-13T21:24:45Z @kj added
- [ ] `ACC-BUILD-22` **npm and PyPI never diverge** - CRITICAL; a finished release leaves both registries on the same version; a failed upload never leaves only one of them written
  - test: force a twine failure, assert the target exits non-zero and prints the recovery command
  - test-tags: MANUAL
  - log: 2026-10-13T21:24:45Z @kj added
- [ ] `ACC-BUILD-23` **Gates run before upload** - HIGH; prettier, eslint, stylelint and the Jest suite all run before anything reaches npm or PyPI
  - test: break a test, run the publish target, assert it stops before either upload
  - test-tags: MANUAL
  - log: 2026-10-13T21:24:46Z @kj added
- [x] `ACC-BUILD-24` **make build does not consume a version** - HIGH; `make build` leaves the version in package.json unchanged, so a build can be repeated and a published version can be rebuilt
  - evidence: make build run on 2026-10-13 against 1.1.109 emitted wheel and sdist still at 1.1.109, package.json unchanged
  - test: note the version, run make build, assert package.json is unchanged
  - test-tags: MANUAL
  - log: 2026-10-13T21:24:46Z @kj added
  - log: 2026-10-13T21:24:59Z @kj closed: holds since Makefile template 1.42 moved increment_version onto install
- [ ] `ACC-BUILD-25` **Fresh clone self-heals** - HIGH; a clone with no .nodeenv, no node_modules and no dist builds after check_dependencies, which installs only what is missing
  - test: clone to a new directory, run make build, assert it completes without a manual install
  - test-tags: MANUAL
  - log: 2026-10-13T21:24:46Z @kj added
- [ ] `ACC-BUILD-26` **Clean tree after a release** - MEDIUM; the working tree is clean once a release finishes; no regenerated lockfile or test artefact left modified
  - test: run a release, assert git status --porcelain is empty
  - test-tags: MANUAL
  - log: 2026-10-13T21:24:46Z @kj added

## Document tab icons `TABS`

Icons on the dock panel tabs of open documents, matching the file browser

- [ ] `ACC-TABS-27` **Tab shows the file's icon** - HIGH; the document tab of an open file shows the same vscode-icons glyph as its file browser row, not JupyterLab's stock tab icon
  - related: ACC-ICONS-1 - the same glyph map this must read
  - test: open one file per mapped extension, compare each tab icon against that file's row in the browser
  - test-tags: MANUAL
  - mechanism: 2026-10-13T21:53:24Z @kj replacing JupyterLab's stock tab icon outright is sanctioned, so the override may set the tab's icon rather than decorate it; yield only where another extension already set one
  - mechanism: 2026-10-13T21:28:57Z @kj the tab icon is a `.lm-TabBar-tabIcon` node Lumino renders from the widget's `title.icon` or `title.iconClass`; intended approach is the file browser one - an injected rule painting a `::before` background-image, re-applied by the observer on tab bar mutations
  - log: 2026-10-13T21:28:57Z @kj added
  - log: 2026-10-13T21:53:24Z @kj mechanism overridden; reason: the maintainer sanctioned overriding the standard tab icons and set the yield boundary
- [ ] `ACC-TABS-28` **Edge: unmapped extension in a tab** - MEDIUM; a tab whose file extension is not in the map keeps JupyterLab's own tab icon; no blank space and no fallback glyph
  - test: open a file with an invented extension, assert the stock tab icon renders
  - test-tags: MANUAL
  - log: 2026-10-13T21:28:58Z @kj added
- [ ] `ACC-TABS-29` **Tab icon survives reorder and detach** - MEDIUM; dragging a tab to another dock area, or reordering the tab bar, keeps the tab's icon; Lumino rebuilds the tab nodes on both
  - test: open four files, reorder them and split one into a second dock area, assert every tab keeps its icon
  - test-tags: MANUAL
  - log: 2026-10-13T21:28:58Z @kj added
- [ ] `ACC-TABS-30` **Group toggles gate tab icons** - MEDIUM; a toggled-off icon group restores the stock tab icon for that group after a refresh, matching what the file browser does
  - related: ACC-CONFIG-6 - the file browser half of the same toggle behaviour
  - test: turn enableImageIcons off, refresh, open a .png, assert the tab shows the stock icon
  - test-tags: MANUAL
  - log: 2026-10-13T21:28:58Z @kj added
- [ ] `ACC-TABS-31` **Another extension's tab icon wins** - HIGH; a tab whose icon another extension sets keeps that extension's icon; this extension overrides only tabs carrying JupyterLab's own stock icon - the opposite policy to the file browser, where the override always wins
  - related: ACC-CLASH-9 - the file browser policy this deliberately inverts
  - related: ACC-TABS-27 - the exception to it
  - test: open a document another installed extension owns, assert its tab icon is untouched
  - test-tags: MANUAL
  - log: 2026-10-13T21:53:24Z @kj added
- [ ] `ACC-TABS-32` **Edge: tab with no file behind it** - MEDIUM; a tab that is not a file - terminal, console, launcher, settings editor - keeps its own icon
  - test: open a terminal and the launcher, assert both tab icons are unchanged
  - test-tags: MANUAL
  - log: 2026-10-13T21:53:24Z @kj added

