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

/**
 * Where the icon of the web page a main-area iframe shows may be found: on the
 * server that serves the page. A proxied page's server is its
 * /proxy/[absolute/][<host>:]<port>/ prefix, the last one in the path, on any
 * origin, never the lab origin, whose /favicon.ico is the Jupyter icon.
 *
 * - declared: the address a link rel~="icon" in the frame document must start
 *   with to count, unless it is a data:image URI, which names no server and
 *   counts as well, or null when the document cannot be read (a cross-origin
 *   frame). It keeps the lab's own icons, such as the one a Jupyter error page
 *   declares, off a proxied page
 * - root: the favicon.ico of that server; a lab page that is not proxied has
 *   none
 */
export function faviconSources(
  src: string,
  labOrigin: string
): { declared: string | null; root: string | null } {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return { declared: null, root: null };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { declared: null, root: null };
  }
  const proxied = /^(.*\/proxy\/(?:absolute\/)?(?:[^/]+:)?\d+)(?:\/|$)/.exec(
    url.pathname
  );
  const server = `${url.origin}${proxied ? proxied[1] : ''}/`;
  if (url.origin !== labOrigin) {
    return { declared: null, root: `${server}favicon.ico` };
  }
  return { declared: server, root: proxied ? `${server}favicon.ico` : null };
}
