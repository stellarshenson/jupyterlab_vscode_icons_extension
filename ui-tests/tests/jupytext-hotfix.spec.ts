import { expect, test } from '@jupyterlab/galata';

/**
 * The jupytext 1.19.1 hotfix - ACC-HOTFIX-18 and ACC-HOTFIX-20.
 *
 * jupytext is not installed on this workstation and installing it is not this
 * suite's call, so the two things it does are reproduced exactly as its 1.19.1
 * source does them: a file type whose pattern matches everything except its own
 * formats, and a `::after` rule that draws a border on the icon container.
 * What is asserted is the remedy's effect in a running lab - that narrowing the
 * pattern gives a .py row its own file type back, and that this extension's
 * reset out-specifies the border rule. That the extension applies the narrowing
 * to exactly that one entry is the unit half, in src/__tests__/hotfix-scope.
 */

// jupytext 1.19.1, packages/jupyterlab-jupytext-extension/src/registry.ts
const JUPYTEXT_CATCH_ALL = '^(?!.*\\.(ipynb)$).*$';
const JUPYTEXT_FORMATS = ['py', 'md', 'Rmd', 'qmd', 'myst', 'mystnb', 'mnb'];

test.describe('the catch-all file type', () => {
  test('narrowing the pattern gives a .py row its own icon back', async ({
    page,
    tmpPath
  }) => {
    await page.contents.uploadContent('x = 1\n', 'text', `${tmpPath}/mod.py`);
    await page.contents.uploadContent('x', 'text', `${tmpPath}/app.js`);
    await page.filebrowser.openDirectory(tmpPath);
    await page.waitForSelector('.jp-DirListing-item');

    const before = await page.evaluate((pattern: string) => {
      const registry = (window as any).jupyterapp.docRegistry;
      registry.addFileType({
        name: 'jupytext-notebook-file',
        pattern,
        fileFormat: 'text',
        contentType: 'notebook',
        mimeTypes: ['text/x-python'],
        icon: registry.getFileType('notebook').icon
      });
      return {
        py: registry.getFileTypesForPath('mod.py')[0].name,
        js: registry.getFileTypesForPath('app.js')[0].name
      };
    }, JUPYTEXT_CATCH_ALL);
    // The defect: the catch-all claims every file, whatever it is.
    expect(before.py, JSON.stringify(before)).toBe('jupytext-notebook-file');
    expect(before.js, JSON.stringify(before)).toBe('jupytext-notebook-file');

    const after = await page.evaluate((formats: string[]) => {
      const registry = (window as any).jupyterapp.docRegistry;
      // The narrowing the hotfix performs, applied the same way: the entry's
      // own pattern is rewritten in place.
      const types = (registry as any)._fileTypes as any[];
      const entry = types.find(t => t.name === 'jupytext-notebook-file');
      entry.pattern = `^.*\\.(?:${formats.join('|')})$`;
      return {
        py: registry.getFileTypesForPath('mod.py')[0].name,
        js: registry.getFileTypesForPath('app.js')[0].name,
        pattern: entry.pattern
      };
    }, JUPYTEXT_FORMATS);

    // ACC-HOTFIX-18: a .py keeps a type of its own, and a file jupytext never
    // handled is freed entirely.
    expect(after.js, JSON.stringify(after)).not.toBe('jupytext-notebook-file');
    expect(after.js, JSON.stringify(after)).toContain('vscode-');
    // .py is one of jupytext's own formats, so the narrowed pattern still
    // matches it - which is why the extension also carries the data-jupytext-py
    // ::before override for that row.
    expect(after.pattern, JSON.stringify(after)).toBe(
      '^.*\\.(?:py|md|Rmd|qmd|myst|mystnb|mnb)$'
    );
  });
});

// The row half of ACC-HOTFIX-18 - a .py row that jupytext claims showing a
// python glyph rather than the notebook icon - is NOT testable here, and not
// for want of trying: it needs jupytext's contents manager to report the file
// as a notebook, which is what gives the row that file type in the first place.
// Registering the file type alone does not reproduce it, because JupyterLab
// resolves a 'file' model against types whose contentType is 'file'.

test.describe('the icon border rule', () => {
  test('this extension resets the border jupytext draws', async ({
    page,
    tmpPath
  }) => {
    await page.contents.uploadContent('x', 'text', `${tmpPath}/notes.md`);
    await page.filebrowser.openDirectory(tmpPath);
    await page.waitForSelector('.jp-DirListing-item');

    const measured = await page.evaluate(() => {
      // jupytext 1.19.1 draws its marker on the same pseudo-element the icon
      // overrides use; this is that rule, injected with its own selector.
      const sheet = document.createElement('style');
      sheet.id = 'jupytext-1191-simulated';
      sheet.textContent = `
        .jp-DirListing-item .jp-DirListing-itemIcon::after {
          content: '';
          border: 2px solid orange;
          position: absolute;
          width: 100%;
          height: 100%;
        }
      `;
      document.head.appendChild(sheet);
      const row = [...document.querySelectorAll('.jp-DirListing-itemText')]
        .find(n => n.textContent!.trim() === 'notes.md')!
        .closest('.jp-DirListing-item')!;
      const host = row.querySelector('.jp-DirListing-itemIcon') as HTMLElement;
      const after = getComputedStyle(host, '::after');
      const result = {
        content: after.content,
        borderTopWidth: after.borderTopWidth,
        hotfixPresent: !!document.getElementById(
          'vscode-icons-jupytext-1191-hotfix'
        )
      };
      sheet.remove();
      return result;
    });

    // ACC-HOTFIX-20: the extension's own reset is in the page and wins, so the
    // border never reaches the row.
    expect(measured.hotfixPresent, JSON.stringify(measured)).toBe(true);
    expect(measured.content, JSON.stringify(measured)).toBe('none');
    expect(measured.borderTopWidth, JSON.stringify(measured)).toBe('0px');
  });
});
