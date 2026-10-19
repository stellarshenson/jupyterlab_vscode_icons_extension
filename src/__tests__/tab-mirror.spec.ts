import { mirrorIconForTypes } from '../tab-mirror';

describe('mirrorIconForTypes', () => {
  it('returns the JupyterLab markdown icon for a markdown file type', () => {
    const icon = { name: 'ui-components:markdown' };
    expect(
      mirrorIconForTypes([{ name: 'markdown', contentType: 'file', icon }])
    ).toBe(icon);
  });

  it('returns the JupyterLab python icon for a python file type', () => {
    const icon = { name: 'ui-components:python' };
    expect(
      mirrorIconForTypes([{ name: 'python', contentType: 'file', icon }])
    ).toBe(icon);
  });

  it('returns the JupyterLab json icon for a json file type', () => {
    const icon = { name: 'ui-components:json' };
    expect(
      mirrorIconForTypes([{ name: 'json', contentType: 'file', icon }])
    ).toBe(icon);
  });

  it('returns the JupyterLab markdown icon for the CHANGELOG.md type', () => {
    const icon = { name: 'ui-components:markdown' };
    expect(
      mirrorIconForTypes([
        { name: 'vscode-changelog', contentType: 'file', icon }
      ])
    ).toBe(icon);
  });

  it('returns null for the generic file icon', () => {
    expect(
      mirrorIconForTypes([
        {
          name: 'file',
          contentType: 'file',
          icon: { name: 'ui-components:file' }
        }
      ])
    ).toBeNull();
  });

  it('returns null for the generic text-editor icon', () => {
    expect(
      mirrorIconForTypes([
        {
          name: 'text-editor',
          contentType: 'file',
          icon: { name: 'ui-components:text-editor' }
        }
      ])
    ).toBeNull();
  });

  it('returns null for a non-ui-components icon and does not fall through', () => {
    expect(
      mirrorIconForTypes([
        {
          name: 'vscode-readme',
          contentType: 'file',
          icon: { name: 'vscode-icons:file-type-readme' }
        },
        {
          name: 'markdown',
          contentType: 'file',
          icon: { name: 'ui-components:markdown' }
        }
      ])
    ).toBeNull();
  });

  it('returns null for a notebook content type', () => {
    expect(
      mirrorIconForTypes([
        {
          name: 'notebook',
          contentType: 'notebook',
          icon: { name: 'ui-components:notebook' }
        }
      ])
    ).toBeNull();
  });

  it('returns null when no type carries an icon', () => {
    expect(
      mirrorIconForTypes([{ name: 'markdown', contentType: 'file' }])
    ).toBeNull();
  });

  it('skips the default and text types', () => {
    const icon = { name: 'ui-components:markdown' };
    expect(
      mirrorIconForTypes([
        {
          name: 'default',
          contentType: 'file',
          icon: { name: 'ui-components:file' }
        },
        {
          name: 'text',
          contentType: 'file',
          icon: { name: 'ui-components:text-editor' }
        },
        { name: 'markdown', contentType: 'file', icon }
      ])
    ).toBe(icon);
  });
});
