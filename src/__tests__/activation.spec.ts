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

type FakeRegistry = {
  types: Array<{ name: string }>;
  addFileType: (fileType: { name: string }) => { dispose: () => void };
  getFileTypesForPath: () => Array<{ name: string }>;
  getFileType: () => undefined;
};

const fakeApp = (): { app: any; registry: FakeRegistry } => {
  const types: Array<{ name: string }> = [];
  const registry: FakeRegistry = {
    types,
    addFileType: fileType => {
      types.push(fileType);
      return { dispose: () => undefined };
    },
    getFileTypesForPath: () => [],
    getFileType: () => undefined
  };
  return {
    app: {
      docRegistry: registry,
      shell: { add: () => undefined, currentWidget: null },
      commands: { addCommand: () => undefined },
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

  it('declares both services optional, which is what makes null legal', () => {
    expect(plugin.optional).toHaveLength(2);
    expect(plugin.requires ?? []).toHaveLength(0);
  });
});
