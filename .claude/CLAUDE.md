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
- CSS modules for styling
- Jest for unit testing
- Playwright/Galata for integration testing

**Project Structure**:

- `src/` - TypeScript source code
- `style/` - CSS styling and icon assets
- `lib/` - Compiled JavaScript output
- `jupyterlab_vscode_icons_extension/` - Python package and labextension
- `ui-tests/` - Playwright integration tests

**Development Commands**:

- `jlpm build` - Build development version
- `jlpm build:prod` - Build production version
- `jlpm watch` - Watch mode for development
- `jlpm test` - Run Jest unit tests
- `jupyter labextension develop . --overwrite` - Link extension for development

**Package Naming**:

- Python package: `jupyterlab_vscode_icons_extension`
- NPM package: `jupyterlab_vscode_icons_extension`
- Extension ID: `jupyterlab_vscode_icons_extension`

## Git Commit Standards

Follow conventional commit format without Claude co-authoring:

- `feat: add new icon mappings`
- `fix: correct icon display for markdown files`
- `chore: update dependencies`
- `docs: update installation instructions`

Do not include "Generated with Claude Code" or "Co-Authored-By: Claude" attributions.
