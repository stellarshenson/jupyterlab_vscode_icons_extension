import { expect, galata, test } from '@jupyterlab/galata';

const PLUGIN = '@stellarshenson/jupyterlab-vscode-icons-extension:plugin';
const row = (page: any, name: string) =>
  page.locator('.jp-DirListing-item').filter({
    has: page.getByText(name, { exact: true })
  });

async function openFiles(page: any, tmpPath: string, names: string[]) {
  for (const name of names) {
    await page.contents.uploadContent('', 'text', `${tmpPath}/${name}`);
  }
  await page.contents.uploadContent('', 'text', `${tmpPath}/src/keep`);
  await page.filebrowser.openDirectory(tmpPath);
  await expect(row(page, 'src')).toHaveAttribute('data-src-folder', 'true');
}

async function expectNoOwnPaint(page: any, name: string) {
  const host = row(page, name).locator('.jp-DirListing-itemIcon');
  await expect(host).not.toHaveAttribute('data-vscode-row-icon');
  expect(
    await host.evaluate(
      (node: Element) => getComputedStyle(node, '::before').backgroundImage
    )
  ).toBe('none');
}

async function openTab(page: any, path: string, name: string) {
  await page.evaluate(async (path: string) => {
    await (window as any).jupyterapp.commands.execute('docmanager:open', {
      path,
      factory: 'Editor'
    });
  }, path);
  const tab = page
    .locator('.lm-TabBar-tab[data-type="document-title"]')
    .filter({
      has: page.getByText(name, { exact: true })
    });
  await expect(tab).toBeVisible();
  // Wait until the same observer that decorates tabs has processed this tab.
  await page.waitForTimeout(500);
  return tab.locator('.lm-TabBar-tabIcon');
}

async function registerIndependent(page: any) {
  await page.evaluate(() => {
    const registry = (window as any).jupyterapp.docRegistry;
    const Icon = registry.getFileType('text').icon.constructor;
    const icon = new Icon({
      name: 'regression:independent',
      svgstr:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#00a060" d="M1 1h14v14H1z"/></svg>'
    });
    for (const options of [
      { name: 'independent-pattern', pattern: '^Dockerfile\\.third$' },
      { name: 'independent-long', extensions: ['.native.txt'] },
      { name: 'independent-short', extensions: ['.txt'] },
      { name: 'independent-license', pattern: '^LICENSE\\.env$' }
    ]) {
      registry.addFileType({
        contentType: 'file',
        fileFormat: 'text',
        mimeTypes: ['text/plain'],
        icon,
        ...options
      });
    }
  });
}

test.describe('disabled config filename owners', () => {
  test.use({
    mockSettings: {
      ...galata.DEFAULT_SETTINGS,
      [PLUGIN]: { enableConfigIcons: false }
    }
  });

  test('native rows and tabs survive enabled generic families', async ({
    page,
    tmpPath
  }) => {
    const names = [
      'requirements.txt',
      'requirements-dev.txt',
      'pyproject.toml',
      'setup.py',
      'package.json',
      'Dockerfile.svg',
      'Dockerfile.sh',
      'tsconfig.sh'
    ];
    await openFiles(page, tmpPath, [
      ...names,
      'notes.txt',
      'settings.toml',
      'module.py'
    ]);
    const expected: Record<string, string> = {
      'requirements.txt': 'text',
      'requirements-dev.txt': 'text',
      'pyproject.toml': 'text',
      'setup.py': 'python',
      'package.json': 'json',
      'Dockerfile.svg': 'svg',
      'Dockerfile.sh': 'text',
      'tsconfig.sh': 'text'
    };
    for (const name of names) {
      await expect(row(page, name)).toHaveAttribute(
        'data-file-type',
        expected[name]
      );
      await expectNoOwnPaint(page, name);
      const tab = await openTab(page, `${tmpPath}/${name}`, name);
      await expect(tab).not.toHaveAttribute('data-vscode-tab-icon');
    }
    expect(
      await row(page, 'notes.txt')
        .locator('.jp-DirListing-itemIcon')
        .evaluate(
          (node: Element) => getComputedStyle(node, '::before').backgroundImage
        )
    ).toContain('url(');
    await expect(row(page, 'settings.toml')).toHaveAttribute(
      'data-file-type',
      'vscode-file-type-toml'
    );
    await expect(row(page, 'module.py')).toHaveAttribute(
      'data-file-type',
      'python'
    );
  });

  test('a disabled owner hands its names to independent types, and this extension still wins elsewhere', async ({
    page,
    tmpPath
  }) => {
    await registerIndependent(page);
    await openFiles(page, tmpPath, [
      'Dockerfile.third',
      'requirements.native.txt',
      'notes.txt'
    ]);
    // Dockerfile.third is a config name, and the config group is off, so the
    // independent type's icon is the one the row and tab show.
    const docker = 'Dockerfile.third';
    await expect(row(page, docker)).toHaveAttribute(
      'data-file-type',
      'independent-pattern'
    );
    await expectNoOwnPaint(page, docker);
    await expect(row(page, docker).locator('svg')).toHaveAttribute(
      'data-icon',
      'regression:independent'
    );
    const dockerTab = await openTab(page, `${tmpPath}/${docker}`, docker);
    await expect(dockerTab).toHaveAttribute(
      'data-vscode-tab-icon',
      'registry:independent-pattern'
    );

    // requirements.native.txt has no disabled owner. The independent type's
    // longer extension still wins the registry, so the type stays, but this
    // extension's icon wins over its icon (ACC-CLASH-70, ACC-TABS-71): the
    // file looks exactly like a plain .txt file.
    const native = 'requirements.native.txt';
    await expect(row(page, native)).toHaveAttribute(
      'data-file-type',
      'independent-long'
    );
    const beforeOf = (name: string) =>
      row(page, name)
        .locator('.jp-DirListing-itemIcon')
        .evaluate(
          (node: Element) => getComputedStyle(node, '::before').backgroundImage
        );
    const plainBefore = await beforeOf('notes.txt');
    expect(plainBefore).toContain('url(');
    expect(await beforeOf(native)).toBe(plainBefore);
    const plainTab = await openTab(page, `${tmpPath}/notes.txt`, 'notes.txt');
    const plainKey = await plainTab.getAttribute('data-vscode-tab-icon');
    const nativeTab = await openTab(page, `${tmpPath}/${native}`, native);
    await expect(nativeTab).toHaveAttribute(
      'data-vscode-tab-icon',
      plainKey ?? ''
    );
  });
});

test.describe('disabled doc filename owner', () => {
  test.use({
    mockSettings: {
      ...galata.DEFAULT_SETTINGS,
      [PLUGIN]: { enableDocIcons: false }
    }
  });

  test('an enabled dotenv registration does not reclaim LICENSE.env', async ({
    page,
    tmpPath
  }) => {
    await openFiles(page, tmpPath, ['LICENSE.env', 'sample.env']);
    await expect(row(page, 'LICENSE.env')).toHaveAttribute(
      'data-file-type',
      'text'
    );
    await expectNoOwnPaint(page, 'LICENSE.env');
    const tab = await openTab(page, `${tmpPath}/LICENSE.env`, 'LICENSE.env');
    await expect(tab).not.toHaveAttribute('data-vscode-tab-icon');
    await expect(row(page, 'sample.env')).toHaveAttribute(
      'data-file-type',
      'vscode-file-type-dotenv'
    );
  });

  test('an independent pattern hidden behind the enabled dotenv pattern survives', async ({
    page,
    tmpPath
  }) => {
    await registerIndependent(page);
    await openFiles(page, tmpPath, ['LICENSE.env']);
    await expect(row(page, 'LICENSE.env')).toHaveAttribute(
      'data-file-type',
      'independent-license'
    );
    await expect(row(page, 'LICENSE.env').locator('svg')).toHaveAttribute(
      'data-icon',
      'regression:independent'
    );
    const tab = await openTab(page, `${tmpPath}/LICENSE.env`, 'LICENSE.env');
    await expect(tab).toHaveAttribute(
      'data-vscode-tab-icon',
      'registry:independent-license'
    );
  });
});
