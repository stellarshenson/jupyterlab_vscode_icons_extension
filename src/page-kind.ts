/**
 * Classify the web page a main-area iframe shows, for its tab icon.
 *
 * - local: served by this lab (same origin, which covers jupyter-server-proxy
 *   pages under /proxy/<port>/) or by a loopback host
 * - remote: any other http or https site
 * - null: not a web page (about:blank, srcdoc, blob:, data:, unparsable)
 */

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

export function pageKindForUrl(
  src: string,
  labOrigin: string
): 'local' | 'remote' | null {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }
  return url.origin === labOrigin || LOOPBACK.has(url.hostname)
    ? 'local'
    : 'remote';
}
