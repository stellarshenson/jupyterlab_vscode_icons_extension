/**
 * Plugin activation - ACC-CONFIG-8.
 *
 * ISettingRegistry and IDefaultFileBrowser are both optional in the plugin's
 * declaration, so JupyterLab will call activate with null for either one when
 * nothing provides it. The plugin has to come up on the defaults instead of
 * throwing, which would take the whole extension down with it.
 */

// JupyterLab's own packages resolve to their TypeScript sources in this
// install, and pulling @jupyterlab/filebrowser in drags the whole component
// tree through jest's transform. Only four values are needed at runtime - two
// tokens, the server-connection helper and the icon class - so they stand in
// here and the plugin's own logic is what runs.
jest.mock('@jupyterlab/settingregistry', () => ({
  ISettingRegistry: { name: 'ISettingRegistry' }
}));
jest.mock('@jupyterlab/filebrowser', () => ({
  IDefaultFileBrowser: { name: 'IDefaultFileBrowser' }
}));
jest.mock('@jupyterlab/services', () => ({
  ServerConnection: {
    makeSettings: () => ({ baseUrl: '/' }),
    makeRequest: async () => ({ ok: false, json: async () => ({}) })
  }
}));
jest.mock('@jupyterlab/ui-components', () => ({
  LabIcon: class {
    name: string;
    svgstr: string;
    constructor(options: { name: string; svgstr: string }) {
      this.name = options.name;
      this.svgstr = options.svgstr;
    }
    element(): HTMLElement {
      return document.createElement('div');
    }
  },
  fileIcon: { name: 'ui-components:file' },
  markdownIcon: { name: 'ui-components:markdown' }
}));

import plugin from '../index';

type FakeFileType = Record<string, unknown> & { name: string };

type FakeRegistry = {
  types: FakeFileType[];
  addFileType: (fileType: FakeFileType) => { dispose: () => void };
  getFileTypesForPath: (path: string) => FakeFileType[];
  getFileType: () => undefined;
  getFileTypeForModel: () => { name: string };
  fileTypes: () => Iterable<FakeFileType>;
  changed: { connect: () => void };
};

const fakeApp = (
  options: { getFileTypesForPath?: FakeRegistry['getFileTypesForPath'] } = {}
): { app: any; registry: FakeRegistry } => {
  const types: FakeFileType[] = [];
  const registry: FakeRegistry = {
    types,
    addFileType: fileType => {
      types.push(fileType);
      return { dispose: () => undefined };
    },
    getFileTypesForPath: options.getFileTypesForPath ?? (() => []),
    getFileType: () => undefined,
    getFileTypeForModel: () => ({ name: 'text' }),
    fileTypes: () => types,
    changed: { connect: () => undefined }
  };
  return {
    app: {
      docRegistry: registry,
      shell: { add: () => undefined, currentWidget: null, widgets: () => [] },
      commands: { addCommand: () => undefined },
      contextMenu: { addItem: () => undefined },
      started: Promise.resolve(),
      restored: Promise.resolve()
    },
    registry
  };
};

describe('activate without the optional services', () => {
  it('does not throw when both are null', () => {
    const { app } = fakeApp();
    expect(() => plugin.activate!(app, null, null)).not.toThrow();
  });

  it('registers the default icon set anyway', () => {
    const { app, registry } = fakeApp();
    plugin.activate!(app, null, null);
    // The defaults enable six of the seven groups, so registration must have
    // happened without a settings registry to read them from.
    expect(registry.types.length).toBeGreaterThan(0);
    expect(registry.types.map(t => t.name)).toContain(
      'vscode-file-type-js-official'
    );
  });

  // DEF-ICONS-49: one pattern covered CHANGELOG and CHANGELOG.md, so the
  // markdown file was typed text/plain and drew the text-page glyph.
  it('types CHANGELOG.md as markdown and the bare CHANGELOG as text', () => {
    const { app, registry } = fakeApp();
    plugin.activate!(app, null, null);
    const types = registry.types as Array<{
      name: string;
      pattern?: string;
      mimeTypes?: string[];
      icon?: { name: string };
    }>;
    const claiming = (file: string) =>
      types.filter(t => t.pattern && new RegExp(t.pattern).test(file));
    const md = claiming('CHANGELOG.md');
    expect(md.map(t => t.name)).toEqual(['vscode-changelog-md']);
    expect(md[0].mimeTypes).toEqual(['text/markdown']);
    expect(md[0].icon!.name).toBe('ui-components:markdown');
    const bare = claiming('CHANGELOG');
    expect(bare.map(t => t.name)).toEqual(['vscode-changelog']);
    expect(bare[0].mimeTypes).toEqual(['text/plain']);
  });

  // ACC-ICONS-36: an Arduino sketch is C++ source.
  it('maps .ino to the C++ file type', () => {
    const { app, registry } = fakeApp();
    plugin.activate!(app, null, null);
    const cpp = (
      registry.types as Array<{ name: string; extensions?: string[] }>
    ).find(t => t.name === 'vscode-file-type-cpp-large');
    expect(cpp!.extensions).toContain('.ino');
  });

  it('declares every service optional, which is what makes null legal', () => {
    expect(plugin.optional).toHaveLength(3);
    expect(plugin.requires ?? []).toHaveLength(0);
  });

  // DEF-ICONS-99: jupyterlab_makefile_file_type_extension registers a makefile
  // type whose pattern also claims `Makefile` and sits earlier in the registry,
  // so getFileTypesForPath returns that foreign type alone. The row painter has
  // to scan the registry for this extension's own claim and paint its icon
  // over the foreign glyph the row rendered.
  it('paints the own makefile icon when a foreign type wins the pattern', async () => {
    const foreign: FakeFileType = {
      name: 'makefile',
      pattern:
        '^(Makefile|makefile|GNUmakefile|makefile\\..*|.*\\.(mk|mak|make|makefile))$',
      extensions: ['.mk', '.mak', '.make', '.makefile'],
      icon: {
        name: 'makefile:icon',
        svgstr: '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
      }
    };
    document.body.innerHTML = `
      <div class="jp-DirListing-content">
        <div class="jp-DirListing-item" data-file-type="makefile">
          <div class="jp-DirListing-itemIcon"><svg data-icon="makefile:icon"></svg></div>
          <span class="jp-DirListing-itemText">Makefile</span>
        </div>
      </div>`;
    try {
      const { app } = fakeApp({
        getFileTypesForPath: path => (path === 'Makefile' ? [foreign] : [])
      });
      jest.useFakeTimers();
      plugin.activate!(app, null, null);
      // The row pass is installed from the started promise, 500 ms later.
      await Promise.resolve();
      jest.advanceTimersByTime(500);
      // installIconOverrideCSS registers the restored callback.
      await Promise.resolve();
      const host = document.querySelector('.jp-DirListing-itemIcon')!;
      expect(host.getAttribute('data-vscode-row-icon')).toBe(
        'registry:vscode-makefile'
      );
    } finally {
      jest.useRealTimers();
      document.body.innerHTML = '';
    }
  });
});
