/**
 * Iframe page classification for the tab globe icons.
 */

import { faviconSources, pageKindForUrl } from '../page-kind';

const LAB = 'http://localhost:8888';

describe('pageKindForUrl', () => {
  it.each([
    ['http://localhost:8888/user/u/proxy/44673/', 'local'],
    ['https://hub.example.com/user/u/proxy/8050/', 'local'],
    ['http://127.0.0.1:5000/', 'local'],
    ['http://[::1]:3000/', 'local'],
    ['http://localhost:9000/', 'local'],
    ['https://docs.python.org/3/', 'remote'],
    ['http://192.168.1.20/', 'remote']
  ])('classifies %s as %s', (src, kind) => {
    const origin = src.startsWith('https://hub.example.com')
      ? 'https://hub.example.com'
      : LAB;
    expect(pageKindForUrl(src, origin)).toBe(kind);
  });

  it.each(['', 'about:blank', 'about:srcdoc', 'blob:http://x/1', 'nonsense'])(
    'returns null for %p',
    src => {
      expect(pageKindForUrl(src, LAB)).toBeNull();
    }
  );
});

describe('faviconSources', () => {
  it.each([
    [
      'https://docs.python.org/3/library/',
      { declared: null, root: 'https://docs.python.org/favicon.ico' }
    ],
    [
      'http://localhost:8080/app/',
      { declared: null, root: 'http://localhost:8080/favicon.ico' }
    ],
    [
      'http://localhost:8888/user/x/proxy/8050/dash/',
      {
        declared: 'http://localhost:8888/user/x/proxy/8050/',
        root: 'http://localhost:8888/user/x/proxy/8050/favicon.ico'
      }
    ],
    [
      'http://localhost:8888/proxy/absolute/5000/',
      {
        declared: 'http://localhost:8888/proxy/absolute/5000/',
        root: 'http://localhost:8888/proxy/absolute/5000/favicon.ico'
      }
    ],
    [
      'http://localhost:8888/proxy/3000',
      {
        declared: 'http://localhost:8888/proxy/3000/',
        root: 'http://localhost:8888/proxy/3000/favicon.ico'
      }
    ],
    [
      'http://localhost:8888/user/x/files/report.html',
      { declared: 'http://localhost:8888/', root: null }
    ],
    [
      'http://localhost:8888/proxy/localhost:8050/',
      {
        declared: 'http://localhost:8888/proxy/localhost:8050/',
        root: 'http://localhost:8888/proxy/localhost:8050/favicon.ico'
      }
    ],
    [
      'http://localhost:8888/user/x/proxy/absolute/127.0.0.1:5000/a',
      {
        declared: 'http://localhost:8888/user/x/proxy/absolute/127.0.0.1:5000/',
        root: 'http://localhost:8888/user/x/proxy/absolute/127.0.0.1:5000/favicon.ico'
      }
    ],
    [
      'http://127.0.0.1:8888/proxy/8050/',
      { declared: null, root: 'http://127.0.0.1:8888/proxy/8050/favicon.ico' }
    ],
    [
      'http://localhost:8888/proxy/absolute/8888/proxy/8050/x',
      {
        declared: 'http://localhost:8888/proxy/absolute/8888/proxy/8050/',
        root: 'http://localhost:8888/proxy/absolute/8888/proxy/8050/favicon.ico'
      }
    ]
  ])('finds the icon of %s', (src, sources) => {
    expect(faviconSources(src, LAB)).toEqual(sources);
  });

  it.each([
    'about:blank',
    'blob:http://localhost:8888/1',
    'data:text/html,x',
    'nonsense'
  ])('finds nothing for %p', src => {
    expect(faviconSources(src, LAB)).toEqual({ declared: null, root: null });
  });
});
