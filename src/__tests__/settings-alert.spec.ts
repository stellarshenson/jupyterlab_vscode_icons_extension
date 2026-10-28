/**
 * The settings-change alert - ACC-CONFIG-7.
 *
 * Every toggle the user flips fires the registry's `changed` signal, and the
 * extension answers with a modal alert asking for a refresh. Resetting the
 * settings fires it seven times in a row, so the alert is debounced by 500 ms
 * and the user sees one. The timer is what this test drives: fake timers make
 * the boundary exact instead of a sleep that happens to be long enough.
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

const DEBOUNCE_MS = 500;

const harness = async (): Promise<{
  fireChange: () => void;
  alerts: jest.SpyInstance;
}> => {
  const app: any = {
    docRegistry: {
      addFileType: () => ({ dispose: () => undefined }),
      getFileTypesForPath: () => [],
      getFileType: () => undefined,
      getFileTypeForModel: () => ({ name: 'text' }),
      fileTypes: () => [],
      changed: { connect: () => undefined }
    },
    shell: {
      add: () => undefined,
      currentWidget: null,
      widgets: () => []
    },
    commands: { addCommand: () => undefined },
    contextMenu: { addItem: () => undefined },
    started: Promise.resolve(),
    restored: Promise.resolve()
  };

  let handler: (() => void) | null = null;
  const loaded = {
    get: () => ({ composite: true }),
    changed: {
      connect: (fn: () => void) => {
        handler = fn;
      }
    }
  };
  const settingRegistry: any = { load: async () => loaded };

  const alerts = jest
    .spyOn(window, 'alert')
    .mockImplementation(() => undefined);

  plugin.activate!(app, settingRegistry, null);
  // Let the `load(...).then(...)` chain run so the signal is connected.
  await Promise.resolve();
  await Promise.resolve();

  return {
    fireChange: () => handler && handler(),
    alerts
  };
};

describe('settings change alert', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows one alert for a burst of changes', async () => {
    const { fireChange, alerts } = await harness();
    alerts.mockClear();

    for (let i = 0; i < 7; i++) {
      fireChange();
      jest.advanceTimersByTime(50);
    }
    expect(alerts).not.toHaveBeenCalled();

    jest.advanceTimersByTime(DEBOUNCE_MS);
    expect(alerts).toHaveBeenCalledTimes(1);
  });

  it('waits the full debounce before showing it', async () => {
    const { fireChange, alerts } = await harness();
    alerts.mockClear();

    fireChange();
    jest.advanceTimersByTime(DEBOUNCE_MS - 1);
    expect(alerts).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(alerts).toHaveBeenCalledTimes(1);
  });

  it('shows a second alert for a second burst', async () => {
    const { fireChange, alerts } = await harness();
    alerts.mockClear();

    fireChange();
    jest.advanceTimersByTime(DEBOUNCE_MS);
    fireChange();
    jest.advanceTimersByTime(DEBOUNCE_MS);
    expect(alerts).toHaveBeenCalledTimes(2);
  });
});
