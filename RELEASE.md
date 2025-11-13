# Release Notes

## Version 1.0.37 (STABLE)

README.md icon refinements - adjusted transparent "i" cutout for optimal visual balance.

### Features

- Custom README.md icon with purple filled circle (#9826c8)
- Transparent "i" cutout using SVG mask technique
- Courier New monospace font for consistent typography
- Fine-tuned boldness with font size 20px and stroke-width 0.7px

### Technical Details

The README.md icon uses an SVG mask to create a transparent cutout effect where the lowercase "i" appears as a hole in the purple circle, allowing the background to show through. This provides better visual integration with both light and dark JupyterLab themes.

### Related Features

- CLAUDE.md icon with purple-tinted Claude branding
- Unified shell script icons with color differentiation (pale red for Linux .sh/.bash/.zsh, pale blue for Windows .bat/.cmd)
- Jupytext file icon overrides for .py and .md notebook files
- Settings system with debounced change alerts

### Compatibility

- JupyterLab 4.0+
- Works with Jupytext extension
- Compatible with both light and dark themes
