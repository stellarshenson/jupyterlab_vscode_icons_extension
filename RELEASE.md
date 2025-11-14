# Release Notes

## Version 1.0.62

Fixed persistent icon color swapping issue where non-shell files incorrectly displayed shell script styling.

### Bug Fixes

- Fixed JavaScript, PNG, and TOML files incorrectly showing orange shell script color filter
- Changed CSS selectors to require both `data-file-type="vscode-file-type-shell"` AND `data-shell-type` attributes
- Refactored `markSpecialFiles()` function to actively remove incorrect attributes from non-matching files
- Prevents race conditions where DOM element reuse causes attribute persistence after file type changes

### Technical Details

The issue occurred when JupyterLab's virtual scrolling reused DOM elements between different file types. The previous implementation cleared all attributes at the start of the observer function, but JupyterLab could update the `data-file-type` attribute after our observer ran, leaving stale `data-shell-type` attributes on non-shell files.

The solution implements defensive attribute handling - for each item, the function now checks the current `data-file-type` and actively removes `data-shell-type` if the item is not a shell file. Shell-type attributes are only set when both the file type AND file extension match shell script patterns.

### Compatibility

- JupyterLab 4.0+
- Works with Jupytext extension
- Compatible with both light and dark themes
