/**
 * Iframe page classification for the tab globe icons.
 */

import { pageKindForUrl } from '../page-kind';

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
