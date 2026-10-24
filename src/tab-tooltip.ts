/**
 * Tooltip on a main-area tab after a longer hover: the full label, the file
 * path, page URL or terminal working directory, the last activity as time
 * ago, and the rest of the tab's caption (ACC-TABS-63 to 69).
 *
 * Last activity is the later of the last text change in the tab and the last
 * time the tab was opened. The tooltip goes on a right-click, a press, a key
 * or the pointer leaving the tab.
 */

import type { JupyterFrontEnd } from '@jupyterlab/application';
import { Time, URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
import type { Widget } from '@lumino/widgets';

const HOVER_MS = 800;

/**
 * The working directory of a terminal's shell, read by the server extension;
 * empty when the server cannot read it.
 */
async function terminalCwd(name: string): Promise<string> {
  const settings = ServerConnection.makeSettings();
  const url = URLExt.join(
    settings.baseUrl,
    'vscode-icons',
    'terminal-cwd',
    encodeURIComponent(name)
  );
  try {
    const response = await ServerConnection.makeRequest(url, {}, settings);
    return response.ok ? ((await response.json()).cwd ?? '') : '';
  } catch {
    return '';
  }
}

/**
 * The tooltip's lines; the location is left out when it repeats the label.
 * The caption JupyterLab would have shown follows (Last Saved, Read-only,
 * Kernel), without its lines that end in the label or the location.
 */
export function tabTooltipLines(
  label: string,
  location: string,
  lastActivity: number | undefined,
  caption = ''
): string[] {
  const lines = [label];
  if (location && location !== label) {
    lines.push(location);
  }
  if (lastActivity !== undefined) {
    lines.push(`Last activity: ${Time.formatHuman(new Date(lastActivity))}`);
  }
  for (const line of caption.split('\n')) {
    if (
      line &&
      !line.endsWith(label) &&
      !(location && line.endsWith(location))
    ) {
      lines.push(line);
    }
  }
  return lines;
}

export function installTabTooltips(app: JupyterFrontEnd): void {
  const lastActivity = new WeakMap<Widget, number>();
  const touch = (widget: Widget): void => {
    lastActivity.set(widget, Date.now());
  };
  const watch = (widget: Widget): void => {
    // A widget gets its first activity time here, so a time means watched.
    if (lastActivity.has(widget)) {
      return;
    }
    touch(widget);
    // Attributes are left out: a cursor blink or a hover class is not text.
    const observer = new MutationObserver(() => touch(widget));
    observer.observe(widget.node, {
      childList: true,
      characterData: true,
      subtree: true
    });
    widget.disposed.connect(() => observer.disconnect());
    // A terminal draws its output on a canvas, so no text reaches the DOM.
    // The widget as receiver lets its dispose drop this connection.
    (widget as any).content?.session?.messageReceived?.connect(
      () => touch(widget),
      widget
    );
  };
  const watchAll = (): void => {
    for (const widget of app.shell.widgets('main')) {
      watch(widget);
    }
  };
  const shell = app.shell as any;
  shell.layoutModified?.connect(watchAll);
  shell.currentChanged?.connect(
    (_: unknown, args: { newValue: Widget | null }) => {
      if (args.newValue) {
        watch(args.newValue);
        touch(args.newValue);
      }
    }
  );
  void app.restored.then(watchAll);

  const locationOf = async (widget: Widget): Promise<string> => {
    const path = (widget as any).context?.path;
    if (typeof path === 'string') {
      return path;
    }
    const terminal = (widget as any).content?.session?.name;
    if (typeof terminal === 'string') {
      return terminalCwd(terminal);
    }
    const frame = widget.node.querySelector('iframe');
    return frame && /^https?:/.test(frame.src) ? frame.src : '';
  };

  let hovered: HTMLElement | null = null;
  let savedTitle: string | null = null;
  let timer = 0;
  let tip: HTMLElement | null = null;
  // Moved on by every hide, so a working directory that arrives after one
  // shows nothing.
  let generation = 0;

  const hideTip = (): void => {
    window.clearTimeout(timer);
    timer = 0;
    generation++;
    tip?.remove();
    tip = null;
  };
  // Lumino writes the caption back into title whenever it changes (a save, a
  // checkpoint), so a returning attribute is held back again (DEF-TABS-83).
  const titleWatch = new MutationObserver(() => {
    if (hovered?.hasAttribute('title')) {
      savedTitle = hovered.getAttribute('title');
      hovered.removeAttribute('title');
    }
  });
  const leave = (): void => {
    hideTip();
    titleWatch.disconnect();
    // The browser's own title tooltip would show beside this one, so the
    // attribute is held back while the tab is hovered.
    if (hovered && savedTitle !== null && !hovered.hasAttribute('title')) {
      hovered.setAttribute('title', savedTitle);
    }
    hovered = null;
    savedTitle = null;
  };
  const show = async (tab: HTMLElement): Promise<void> => {
    const widget = [...app.shell.widgets('main')].find(
      candidate => candidate.id === tab.dataset.id
    );
    if (!widget) {
      return;
    }
    const shown = generation;
    const location = await locationOf(widget);
    if (shown !== generation || !tab.isConnected) {
      return;
    }
    const activity = lastActivity.get(widget);
    tip = document.createElement('div');
    tip.className = 'vscode-tab-tooltip';
    tip.setAttribute('role', 'tooltip');
    if (activity !== undefined) {
      tip.dataset.lastActivity = String(activity);
    }
    for (const line of tabTooltipLines(
      widget.title.label,
      location,
      activity,
      widget.title.caption
    )) {
      const row = document.createElement('div');
      row.className = 'vscode-tab-tooltip-line';
      row.textContent = line;
      tip.appendChild(row);
    }
    document.body.appendChild(tip);
    const box = tab.getBoundingClientRect();
    const left = Math.min(box.left, window.innerWidth - tip.offsetWidth - 4);
    tip.style.left = `${Math.max(4, left)}px`;
    tip.style.top = `${box.bottom + 4}px`;
  };

  const tabOf = (target: EventTarget | null): HTMLElement | null =>
    target instanceof Element
      ? target.closest<HTMLElement>('.lm-DockPanel-tabBar .lm-TabBar-tab')
      : null;
  document.addEventListener('mouseover', event => {
    const tab = tabOf(event.target);
    if (tab === hovered) {
      return;
    }
    leave();
    if (tab) {
      hovered = tab;
      savedTitle = tab.getAttribute('title');
      tab.removeAttribute('title');
      titleWatch.observe(tab, { attributeFilter: ['title'] });
      timer = window.setTimeout(() => void show(tab), HOVER_MS);
    }
  });
  document.addEventListener('mouseout', event => {
    if (hovered && !hovered.contains(event.relatedTarget as Node | null)) {
      leave();
    }
  });
  for (const type of ['mousedown', 'contextmenu', 'wheel', 'keydown']) {
    document.addEventListener(type, hideTip, true);
  }
}
