import { expect, test } from '@jupyterlab/galata';

/**
 * The reused-row window - DEF-ICONS-31-1.
 *
 * The file browser reuses its row nodes, and the name-based overrides are
 * cleared and re-set by a pass that also waits on the python manifest reads.
 * While those round-trips were awaited, a reused row kept the previous file's
 * ::before artwork: measured 136 ms on localhost and 717 ms at 150 ms RTT.
 * The DOM half now runs before the reads, so the window closes at the first
 * frame.
 *
 * The latency is emulated on purpose: on a warm localhost the round-trips are
 * fast enough that the old code also looks instant, which is what made a first
 * version of this test pass against the regression.
 */

const LATENCY_MS = 300;

test('a reused row drops the previous override within a frame', async ({
  page,
  tmpPath
}) => {
  await page.contents.uploadContent('x', 'text', `${tmpPath}/dirA/a.pdf`);
  await page.contents.uploadContent('x', 'text', `${tmpPath}/dirB/a.js`);
  await page.filebrowser.openDirectory(`${tmpPath}/dirA`);
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('.jp-DirListing-item')].some(r =>
        r.hasAttribute('data-vscode-pdf')
      ),
    undefined,
    { timeout: 30000 }
  );

  // Galata's page is a proxy, which the CDP session refuses, so the latency is
  // applied where it matters: the contents request the override pass waits on.
  await page.route('**/api/contents/**', async (route: any) => {
    await new Promise(resolve => setTimeout(resolve, LATENCY_MS));
    await route.continue();
  });

  // Sample while the directory changes, not after: the window is open during
  // the navigation's own round-trips.
  const sampling = page.evaluate(
    (budget: number) =>
      new Promise<Array<{ t: number; stale: string[] }>>(resolve => {
        const out: Array<{ t: number; stale: string[] }> = [];
        const t0 = performance.now();
        const tick = () => {
          const stale = [...document.querySelectorAll('.jp-DirListing-item')]
            .filter(row => {
              const label = row.querySelector('.jp-DirListing-itemText');
              const name = label && label.textContent ? label.textContent : '';
              // The badge half of this window is not sampled here: the badge
              // needs enableExecutableIcons, which defaults off, and a file
              // with the +x bit, which the contents API cannot create - so an
              // assertion on it would pass whatever the code does
              // (DEF-ICONS-37).
              return (
                !name.endsWith('.pdf') && row.hasAttribute('data-vscode-pdf')
              );
            })
            .map(row => {
              const label = row.querySelector('.jp-DirListing-itemText');
              return label && label.textContent ? label.textContent : '?';
            });
          if (stale.length) {
            out.push({ t: Math.round(performance.now() - t0), stale });
          }
          if (performance.now() - t0 < budget) {
            requestAnimationFrame(tick);
          } else {
            resolve(out);
          }
        };
        requestAnimationFrame(tick);
      }),
    3000
  );
  await page.filebrowser.openDirectory(`${tmpPath}/dirB`);
  const stale = await sampling;

  const window = stale.length > 0 ? stale[stale.length - 1].t - stale[0].t : 0;
  console.log(
    'REUSE stale-frames=' + stale.length + ' window=' + window + 'ms'
  );
  expect(stale.length, JSON.stringify(stale.slice(0, 5))).toBe(0);
});
