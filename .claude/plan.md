# Investigation Plan: Missing Standard JupyterLab Icons

## Problem Statement
Standard JupyterLab icons from multiple sources stopped displaying and show as generic gray icons:
- Icons registered by vscode-icons extension: PNG, SVG, JSON, CSV, Excel
- Icons registered by OTHER extensions: ZIP (from jupyterlab_zip_extension), YML, Parquet

This affects both vscode-icons file types AND file types from other extensions, suggesting a systemic issue.

## Investigation Findings

### What I've Ruled Out

1. **CSS targeting specific attributes** - All CSS rules in vscode-icons require specific data attributes (e.g., `[data-vscode-pdf]`, `[data-jupytext-py]`). These wouldn't affect zip or yml files which have no such attributes set.

2. **File type registration conflicts for unregistered extensions** - vscode-icons does NOT register `.zip`, `.yml`, `.yaml`, or `.parquet`. These extensions can't conflict with something that isn't registered.

3. **Recent code changes** - Diff between v1.1.14 and current shows only additive changes:
   - Added `enableExecutableIcons` setting
   - Extended shell script extensions (.fish, .csh, .nu)
   - Changed requirements.txt pattern
   - Added executable file detection

### Potential Root Causes

1. **CSS `display: inline-flex` in base.css** (lines 23-28)
   ```css
   .jp-DirListing-item .jp-DirListing-itemIcon {
     display: inline-flex;
     align-items: center;
     margin-right: 4px;
     justify-content: center;
   }
   ```
   This applies to ALL file browser icons. Could be interfering with how icons are rendered if JupyterLab's expected display type differs.

2. **Version mismatch** - Installed version is 1.1.14 but code has many uncommitted/unpushed changes. Need to verify which version is actually running.

3. **JupyterLab or dependency update** - If JupyterLab's core CSS/rendering changed, it could affect icon display.

4. **Extension load order** - If vscode-icons loads before other extensions, its file type registrations could be affecting file type resolution order.

## Proposed Investigation Steps

### Step 1: Verify installed vs running version
```bash
pip show jupyterlab-vscode-icons-extension
jupyter labextension list | grep vscode
```

### Step 2: Test with extension disabled
Temporarily disable the vscode-icons extension and verify if other extensions' icons (zip, yml) display correctly:
```bash
jupyter labextension disable jupyterlab_vscode_icons_extension
# Refresh JupyterLab, check if zip icons appear
jupyter labextension enable jupyterlab_vscode_icons_extension
```

### Step 3: Check browser console
Open JupyterLab's browser console (F12) and look for:
- JavaScript errors during extension activation
- CSS loading errors
- Any warnings about file type registration

### Step 4: Test base.css removal
Comment out the `.jp-DirListing-item .jp-DirListing-itemIcon` rule in style/base.css and rebuild to test if this CSS is causing the issue.

### Step 5: Check file type registry order
Add debug logging to see what file types are registered and in what order:
```typescript
console.log('Registered file types:', Array.from(docRegistry.fileTypes()).map(ft => ft.name));
```

## Recommended First Action

**Step 2 (disable extension)** is the fastest way to determine if vscode-icons is the cause. If disabling the extension restores other icons, the problem is definitively in vscode-icons. If icons remain broken, the issue is elsewhere (JupyterLab update, another extension, etc.).
