<!-- @import /home/lab/workspace/.claude/CLAUDE.md -->

# Project-Specific Configuration

This file imports workspace-level configuration from `/home/lab/workspace/.claude/CLAUDE.md`.
All workspace rules apply. Project-specific rules below strengthen or extend them.

The workspace `/home/lab/workspace/.claude/` directory contains additional instruction files
(MERMAID.md, NOTEBOOK.md, DATASCIENCE.md, GIT.md, and others) referenced by CLAUDE.md.
Consult workspace CLAUDE.md and the .claude directory to discover all applicable standards.

## Mandatory Bans (Reinforced)

The following workspace rules are STRICTLY ENFORCED for this project:

- **No automatic git tags** - only create tags when user explicitly requests
- **No automatic version changes** - only modify version in package.json/pyproject.toml/etc. when user explicitly requests
- **No automatic publishing** - never run `make publish`, `npm publish`, `twine upload`, or similar without explicit user request
- **No manual package installs if Makefile exists** - use `make install` or equivalent Makefile targets, not direct `pip install`/`uv install`/`npm install`
- **No automatic git commits or pushes** - only when user explicitly requests

## Project Context

**jupyterlab_vscode_icons_extension** is a JupyterLab 4.x extension that brings VSCode-style file icons to the JupyterLab file browser.

**Technology Stack**:

- JupyterLab 4.0+
- TypeScript 5.8
- CSS styling and SVG icon assets
- Jest for unit testing
- Playwright/Galata for integration testing

**Project Structure**:

- `src/` - TypeScript source code
- `style/` - CSS styling and icon assets
- `lib/` - Compiled JavaScript output
- `jupyterlab_vscode_icons_extension/` - Python package and the built frontend
- `ui-tests/` - Playwright integration tests

**Development Commands**:

- `make install_dependencies` - Prepare the project toolchain
- `make build` - Build the distribution packages
- `make test` - Run the unit and Python test checks
- `make install` - Build and install the wheel; this also increments the patch version
- `jlpm build` and `jupyter-builder develop . --overwrite` - Development loop described in `CONTRIBUTING.md`

**Package Naming**:

- Python package: `jupyterlab_vscode_icons_extension`
- NPM package: `@stellarshenson/jupyterlab-vscode-icons-extension`
- Extension ID: `jupyterlab_vscode_icons_extension`

## Journal Rules (Project-Specific)

- **APPEND ONLY**: New journal entries MUST be appended at the end of the file, never inserted between existing entries
- Entries maintain strict chronological order by position - the last entry in the file is always the most recent work
- Never reorder, move, or insert entries out of sequence
- The Stellars **journal plugin** is the canonical tool for this file: create via `/journal:create`, append via `/journal:update`, archive via `/journal:archive`. The `journal:journal` skill auto-triggers on any mention of "journal" and runs `journal-tools check` after every write
- Direct edits to `JOURNAL.md` are a last resort - prefer the plugin so modus secundis format, continuous numbering and append-only order are enforced automatically

## Strengthened Rules

- Use the Makefile for build and test work. Check whether a target changes `package.json` before running it; `make install` increments the patch version.

## Git Commit Standards

Follow conventional commit format without Claude co-authoring:

- `feat: add new icon mappings`
- `fix: correct icon display for markdown files`
- `chore: update dependencies`
- `docs: update installation instructions`

Do not include "Generated with Claude Code" or "Co-Authored-By: Claude" attributions.
