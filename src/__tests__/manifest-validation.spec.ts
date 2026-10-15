/**
 * Manifest validation before package name extraction - DEF-ICONS-55.
 *
 * ACC-PYPKG-17 promises that a malformed pyproject.toml or setup.py leaves
 * every folder with its normal icon. The local parsers are regexes and still
 * take a name out of a manifest that does not parse, so the source goes to
 * the server's validation route first and an invalid answer drops the names.
 * A failed call - the frontend-only install has no route - keeps them.
 */

jest.mock('@jupyterlab/settingregistry', () => ({
  ISettingRegistry: { name: 'ISettingRegistry' }
}));
jest.mock('@jupyterlab/filebrowser', () => ({
  IDefaultFileBrowser: { name: 'IDefaultFileBrowser' }
}));
jest.mock('@jupyterlab/services', () => ({
  ServerConnection: {
    makeSettings: () => ({ baseUrl: '/' }),
    makeRequest: jest.fn()
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

import { ServerConnection } from '@jupyterlab/services';

import { packageNamesFromManifest } from '../index';
import { parsePyprojectToml, parseSetupPy } from '../parsers';

const makeRequest = ServerConnection.makeRequest as jest.Mock;

const answer = (valid: boolean): void => {
  makeRequest.mockResolvedValue({
    ok: true,
    json: async () => ({ valid })
  });
};

describe('packageNamesFromManifest', () => {
  beforeEach(() => {
    makeRequest.mockReset();
  });

  it('adds no name a malformed pyproject.toml would otherwise contribute', async () => {
    // The name line is complete; the unterminated string after it breaks the
    // document, and the local regex takes the name anyway.
    const source = '[project]\nname = "sample"\ninvalid = [\n';
    expect(parsePyprojectToml(source).size).toBeGreaterThan(0);
    answer(false);
    expect(await packageNamesFromManifest(source, 'toml')).toEqual(new Set());
  });

  it('adds no name a truncated setup.py would otherwise contribute', async () => {
    // The closure of setup() is missing, so the file is not valid Python; the
    // local regex still finds the name.
    const source = 'setup(name="sample"';
    expect(parseSetupPy(source).size).toBeGreaterThan(0);
    answer(false);
    expect(await packageNamesFromManifest(source, 'python')).toEqual(new Set());
  });

  it('posts the source to the validation route and keeps a valid answer', async () => {
    const source = '[project]\nname = "my-package"\n';
    answer(true);
    const names = await packageNamesFromManifest(source, 'toml');
    expect(makeRequest).toHaveBeenCalledWith(
      '/vscode-icons/validate-manifest',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ kind: 'toml', source })
      }),
      expect.anything()
    );
    expect(names.has('my-package')).toBe(true);
  });

  it('keeps the local names when the route is absent', async () => {
    // A frontend-only install has no server half: the call 404s and the
    // local parse stands, silently, as it did before the validation existed.
    const source = '[project]\nname = "my-package"\n';
    makeRequest.mockResolvedValue({
      ok: false,
      json: async () => ({})
    });
    const names = await packageNamesFromManifest(source, 'toml');
    expect(names.has('my-package')).toBe(true);
  });

  it('keeps the local names when the call cannot complete', async () => {
    const source = 'setup(name="my-package")';
    makeRequest.mockRejectedValue(new Error('network'));
    const names = await packageNamesFromManifest(source, 'python');
    expect(names.has('my-package')).toBe(true);
  });
});
