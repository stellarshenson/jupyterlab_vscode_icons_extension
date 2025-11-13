<!-- Import workspace-level CLAUDE.md configuration -->
<!-- See /home/lab/workspace/.claude/CLAUDE.md for complete rules -->

# Project-Specific Configuration

This file extends workspace-level configuration with project-specific rules.

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
