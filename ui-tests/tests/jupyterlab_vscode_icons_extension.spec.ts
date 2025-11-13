import { expect, test } from '@jupyterlab/galata';

test('should load the extension', async ({ page }) => {
  // Wait for JupyterLab to load
  await page.goto();

  // Check that the extension is registered by verifying custom file types exist
  const isExtensionLoaded = await page.evaluate(() => {
    // Access JupyterLab's application instance
    const app = (window as any).jupyterapp;
    if (!app) {
      return false;
    }

    // Check if our custom file types are registered
    const docRegistry = app.docRegistry;
    if (!docRegistry) {
      return false;
    }

    // Look for one of our registered file types (vscode-file-type-python)
    const fileTypes = Array.from(docRegistry.fileTypes());
    return fileTypes.some(
      (ft: any) => ft.name && ft.name.startsWith('vscode-file-type-')
    );
  });

  expect(isExtensionLoaded).toBe(true);
});
