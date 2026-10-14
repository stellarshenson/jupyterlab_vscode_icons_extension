import { expect, test } from '@jupyterlab/galata';

/**
 * Row outline markers across a theme switch - DEF-COLOUR-48.
 *
 * The outline marker says the artwork cannot be seen on the background it sits
 * on, so it is a per-theme answer. A theme switch produces no listing mutation
 * and no layout change, which is what the painters watch, so before the body
 * observer existed a row kept the previous theme's marker until the listing
 * next changed. The subject is build.gradle: its artwork measures 1.51:1 on a
 * white listing and clears the bar on the dark one, so the correct marker
 * differs between the two themes and a stale one is visible as a failure.
 */

const outlined = (page: any): Promise<boolean | null> =>
  page.evaluate(() => {
    const label = [
      ...document.querySelectorAll('.jp-DirListing-itemText')
    ].find(n => n.textContent!.trim() === 'build.gradle');
    const item = label ? label.closest('.jp-DirListing-item') : null;
    const host = item ? item.querySelector('.jp-DirListing-itemIcon') : null;
    return host ? host.hasAttribute('data-vscode-row-outline') : null;
  });

// Galata's own helper, the same one tab-icons.spec.ts uses, then wait for the
// body flag rather than a fixed time: the switch is a stylesheet swap.
const settleTheme = (page: any, wantLight: boolean): Promise<void> =>
  page.waitForFunction(
    (light: boolean) =>
      (document.body.getAttribute('data-jp-theme-light') === 'true') === light,
    wantLight,
    { timeout: 30000 }
  );

test('a row outline marker follows a theme switch', async ({
  page,
  tmpPath
}) => {
  await page.contents.uploadContent('x', 'text', `${tmpPath}/build.gradle`);
  await page.filebrowser.openDirectory(tmpPath);
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('.jp-DirListing-itemIcon')].some(h =>
        h.hasAttribute('data-vscode-row-icon')
      ),
    undefined,
    { timeout: 30000 }
  );

  await page.theme.setLightTheme();
  await settleTheme(page, true);
  await page.waitForTimeout(500);
  const onLight = await outlined(page);
  await page.theme.setDarkTheme();
  await settleTheme(page, false);
  await page.waitForTimeout(500);
  const onDark = await outlined(page);

  // Nothing is touched between the two reads but the theme, so if the marker
  // never changes the painter is not following the switch.
  expect(
    { onLight, onDark },
    'the marker is the same on both themes, so it did not follow the switch'
  ).toEqual({ onLight: true, onDark: false });
});
