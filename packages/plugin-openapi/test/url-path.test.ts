import { describe, expect, it } from 'vitest';

import { joinUrlPath } from '../src/url-path.js';

describe('joinUrlPath', () => {
  it.each([
    // basePath as produced by `new URL(...).pathname`, path as an OpenAPI key
    ['', '/pets', '/pets'],
    ['/', '/pets', '/pets'],
    ['/v1', '/pets', '/v1/pets'],
    ['/v1/', '/pets', '/v1/pets'],
    ['/v1', 'pets', '/v1/pets'],
    ['/v1/', 'pets', '/v1/pets'],
    // an empty base path means the server root, so the result stays rooted
    ['', 'pets', '/pets'],
    ['', '', '/'],
    ['/', '/', '/'],
    // path templates are preserved verbatim
    ['/v1', '/pet/{petId}', '/v1/pet/{petId}'],
    ['/v1', '/pet/{petId}/uploadImage', '/v1/pet/{petId}/uploadImage'],
    // a trailing slash on the path is a different resource and is kept
    ['/v1', '/pets/', '/v1/pets/'],
    ['/v1', '/', '/v1/'],
    // runs of slashes collapse, including three or more
    ['/v1', '//pets', '/v1/pets'],
    ['/v1', '///pets', '/v1/pets'],
    ['/v1//', '//pets', '/v1/pets'],
    ['/v1', '/a//b', '/v1/a/b'],
    ['/v1', '/a///b', '/v1/a/b'],
  ])('joins %o and %o into %o', (basePath, path, expected) => {
    expect(joinUrlPath(basePath, path)).toBe(expected);
  });

  it.each([
    ['/v1', '/a/../b', '/v1/a/../b'],
    ['/v1', '/a/./b', '/v1/a/./b'],
    ['/v1', '/..', '/v1/..'],
    ['/v1/..', '/pets', '/v1/../pets'],
  ])(
    'does not resolve dot segments when joining %o and %o',
    (basePath, path, expected) => {
      expect(joinUrlPath(basePath, path)).toBe(expected);
    },
  );

  it('never emits a platform separator', () => {
    expect(joinUrlPath('/v1', '/pets')).not.toContain('\\');
  });

  it('treats a backslash as an ordinary path character, not a separator', () => {
    expect(joinUrlPath('/v1', '/pets\\dogs')).toBe('/v1/pets\\dogs');
  });
});
