import { expect, test } from '@jupyterlab/galata';
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const diskPath = (path: string) =>
  join(process.env.JUPYTERLAB_GALATA_ROOT_DIR!, path);
const row = (page: any, name: string) =>
  page.locator('.jp-DirListing-item').filter({
    has: page.getByText(name, { exact: true })
  });

// The live server keeps its executables on a volume outside the root, reached
// through the @volumes link inside it. The volume is created beside the server
// root here, so the link below the root leaves the root the same way.
let volume: string;

test.use({
  mockSettings: {
    '@stellarshenson/jupyterlab-vscode-icons-extension:plugin': {
      enableExecutableIcons: true
    }
  }
});

test.beforeEach(async ({ tmpPath }) => {
  volume = await mkdtemp(join(tmpdir(), 'vscode-icons-volume-'));
  await mkdir(join(volume, 'agentic-messages'));
  const script = join(volume, 'agentic-messages', 'agentmsg.py');
  await writeFile(script, '#!/usr/bin/env python3\n');
  await chmod(script, 0o755);
  await symlink(volume, diskPath(`${tmpPath}/@volumes`), 'dir');
});

test.afterEach(async () => {
  await rm(volume, { recursive: true, force: true });
});

test('the play glyph rides an executable reached through a symlinked volume', async ({
  page,
  tmpPath
}) => {
  await page.filebrowser.openDirectory(`${tmpPath}/@volumes/agentic-messages`);
  await expect(row(page, 'agentmsg.py')).toBeVisible();
  const badge = row(page, 'agentmsg.py').locator('.vscode-exec-badge');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAccessibleName('Executable');
  const src = await badge.getAttribute('src');
  const svg = Buffer.from(src!.split(',')[1], 'base64').toString('utf8');
  expect(svg).toContain('d="M1,0 L11,6 L1,12 Z"');
});
