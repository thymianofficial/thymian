import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import {
  compareSelectors,
  encodeMediaType,
  encodeMethod,
  encodePath,
  formatSelector,
  isSelector,
  parseSelector,
} from '../../src/selectors/selector.js';

function selectorOf(
  req: Parameters<typeof createHttpRequest>[0],
  res: Parameters<typeof createHttpResponse>[0],
): string {
  return formatSelector(createHttpRequest(req), createHttpResponse(res));
}

describe('selector rendering', () => {
  it('renders METHOD path -> status with media parts', () => {
    expect(
      selectorOf(
        { method: 'POST', path: '/astronauts', mediaType: 'application/json' },
        { statusCode: 201, mediaType: 'application/json' },
      ),
    ).toBe('POST /astronauts (application/json) -> 201 (application/json)');
  });

  it('omits a media part exactly when no media type is declared', () => {
    expect(
      selectorOf(
        { method: 'DELETE', path: '/astronauts/{id}', mediaType: '' },
        { statusCode: 204, mediaType: '' },
      ),
    ).toBe('DELETE /astronauts/{id} -> 204');

    expect(
      selectorOf(
        { method: 'GET', path: '/launches', mediaType: '' },
        { statusCode: 200, mediaType: 'application/json' },
      ),
    ).toBe('GET /launches -> 200 (application/json)');
  });

  it('gives a declared media type its part even with no body or schema', () => {
    // A `content:` entry that names a media type but carries no schema still
    // describes a distinct transaction, so it still gets its own selector.
    expect(
      selectorOf(
        {
          method: 'POST',
          path: '/ping',
          mediaType: 'text/plain',
          body: undefined,
        },
        { statusCode: 200, mediaType: 'text/plain', schema: undefined },
      ),
    ).toBe('POST /ping (text/plain) -> 200 (text/plain)');
  });

  it('uppercases the method and supplies a missing leading slash', () => {
    expect(
      selectorOf(
        { method: 'get', path: 'launches' },
        { statusCode: 200, mediaType: '' },
      ),
    ).toBe('GET /launches -> 200');
  });

  it('renders every selector so the grammar accepts it back', () => {
    const oddButLegal = [
      selectorOf(
        { method: 'GET', path: '/a b', mediaType: '' },
        { statusCode: 200, mediaType: '' },
      ),
      selectorOf(
        { method: 'GET', path: '/a->b', mediaType: '' },
        { statusCode: 200, mediaType: '' },
      ),
      selectorOf(
        { method: 'GE T', path: '/x', mediaType: '' },
        { statusCode: 200, mediaType: '' },
      ),
      // `createHttpResponse` would coerce a falsy status back to 200, and this
      // case is precisely about a status that is not a number: a description
      // whose response key is non-numeric arrives as `statusCode: NaN`, and it
      // must render rather than abort the load.
      formatSelector(createHttpRequest({ method: 'GET', path: '/x' }), {
        ...createHttpResponse({ mediaType: '' }),
        statusCode: Number.NaN,
      }),
      selectorOf(
        { method: 'GET', path: '/x', mediaType: '' },
        { statusCode: 200, mediaType: 'text/plain; format="a(b)"' },
      ),
      selectorOf(
        { method: 'GET', path: '/tags/{name}', mediaType: '' },
        {
          statusCode: 200,
          mediaType: 'application/vnd.thymian+json; version=1',
        },
      ),
    ];

    for (const selector of oddButLegal) {
      expect(isSelector(selector), selector).toBe(true);
    }
  });

  it('quotes only what the bare form cannot carry', () => {
    expect(encodePath('/a b')).toBe('"/a b"');
    expect(encodePath('/a->b')).toBe('"/a->b"');
    // Everything else survives bare: braces, parentheses, existing
    // percent-encoding, a trailing slash and a base path.
    expect(encodePath('/v1/users/{userId}/(x)/a%20b/')).toBe(
      '/v1/users/{userId}/(x)/a%20b/',
    );
    expect(encodeMethod('GE T')).toBe('"GE T"');
    expect(encodeMethod('report')).toBe('REPORT');
  });

  it('keeps an already-encoded path distinct from a raw one', () => {
    // The reason quoting replaced percent-encoding: `%20` and a raw space would
    // otherwise render the same string for two different transactions.
    expect(encodePath('/a%20b')).not.toBe(encodePath('/a b'));
  });

  it('preserves quoted-string media parameters, parentheses included', () => {
    expect(encodeMediaType('text/plain; format="a(b)"')).toBe(
      'text/plain; format="a(b)"',
    );
    // A bare parenthesis is not a legal token character, so it is escaped
    // rather than allowed to shadow a media group delimiter.
    expect(encodeMediaType('text/plain; format=a(b)')).toBe(
      'text/plain; format=a\\(b\\)',
    );
  });
});

describe('selector parsing', () => {
  it('round-trips every component', () => {
    const selector =
      'POST /astronauts (application/json) -> 201 (application/vnd.x+json; v=2)';

    expect(parseSelector(selector)).toEqual({
      method: 'POST',
      path: '/astronauts',
      requestMediaType: 'application/json',
      status: 201,
      responseMediaType: 'application/vnd.x+json; v=2',
    });
  });

  it('splits media groups with quote awareness', () => {
    expect(
      parseSelector('GET /x -> 200 (text/plain; format="a) b")'),
    ).toMatchObject({
      status: 200,
      responseMediaType: 'text/plain; format="a) b"',
    });
  });

  it('rejects a non-selector with the grammar and an example', () => {
    expect(() => parseSelector('GET /launches')).toThrowError(
      /is not a valid transaction selector/,
    );
  });

  it('suggests the canonical spelling of a near miss', () => {
    let suggestions: string[] = [];

    try {
      parseSelector('get launches -> 0200');
    } catch (e) {
      suggestions =
        (e as { options?: { suggestions?: string[] } }).options?.suggestions ??
        [];
    }

    expect(suggestions[0]).toContain('Did you mean "GET /launches -> 200"?');
  });

  it('does not invent a path out of a URL', () => {
    let suggestions: string[] = [];

    try {
      parseSelector('get https://api.example.com/launches -> 200');
    } catch (e) {
      suggestions =
        (e as { options?: { suggestions?: string[] } }).options?.suggestions ??
        [];
    }

    expect(suggestions.join(' ')).not.toContain('Did you mean');
  });
});

describe('selector ordering', () => {
  it('is a locale-independent total order on code units', () => {
    const sorted = ['DELETE /a -> 204', 'GET /a -> 200', 'GET /b -> 200'];

    expect([...sorted].reverse().sort(compareSelectors)).toEqual(sorted);
    expect(compareSelectors('GET /a -> 200', 'GET /a -> 200')).toBe(0);
  });
});

/**
 * The property the spec states as "rendering is total and injective": every
 * transaction renders, every rendering parses back to what it came from, and no
 * two distinct transactions share a rendering.
 */
describe('rendering is total and injective', () => {
  const methods = ['GET', 'get', 'REPORT', 'GE T', 'M\nX', '"Q"'];
  const paths = [
    '/launches',
    'launches',
    '/a b',
    '/a->b',
    '/a%20b',
    '/tags/{name}',
    '/(x)/y',
    '/quote"inside',
    '"/starts-with-quote',
    '/back\\slash',
    '/nl\nhere',
    '/',
  ];
  const mediaTypes = [
    '',
    'application/json',
    'text/plain; charset=utf-8',
    'text/plain; format="a(b)"',
    'text/plain; format="a) b"',
    'text/plain; format=a(b)',
    'text/plain; unbalanced="quote',
    'text/plain; back\\slash',
    'text/plain; nl\nhere',
    'application/vnd.thymian+json; version=1',
  ];
  const statuses = [200, 204, 599, 0, Number.NaN, 1.5];

  function render(
    method: string,
    path: string,
    requestMediaType: string,
    status: number,
    responseMediaType: string,
  ): string {
    return formatSelector(
      { ...createHttpRequest({ method, path }), mediaType: requestMediaType },
      {
        ...createHttpResponse(),
        statusCode: status,
        mediaType: responseMediaType,
      },
    );
  }

  it('parses every rendering back to its normalized components', () => {
    for (const method of methods) {
      for (const path of paths) {
        for (const requestMediaType of mediaTypes) {
          for (const status of statuses) {
            for (const responseMediaType of mediaTypes) {
              const selector = render(
                method,
                path,
                requestMediaType,
                status,
                responseMediaType,
              );

              expect(isSelector(selector), selector).toBe(true);

              const parsed = parseSelector(selector);

              expect(parsed.method, selector).toBe(method.toUpperCase());
              expect(parsed.path, selector).toBe(
                path.startsWith('/') ? path : `/${path}`,
              );
              expect(parsed.requestMediaType ?? '', selector).toBe(
                requestMediaType,
              );
              expect(parsed.responseMediaType ?? '', selector).toBe(
                responseMediaType,
              );
              expect(String(parsed.status), selector).toBe(String(status));
            }
          }
        }
      }
    }
  });

  it('never renders two distinct transactions the same way', () => {
    const seen = new Map<string, string>();

    for (const method of methods) {
      for (const path of paths) {
        for (const requestMediaType of mediaTypes) {
          for (const status of statuses) {
            for (const responseMediaType of mediaTypes) {
              // The two canonicalizations rendering performs on purpose: a
              // missing leading slash and method case. Distinct inputs there
              // are the same path and the same method.
              const identity = JSON.stringify([
                method.toUpperCase(),
                path.startsWith('/') ? path : `/${path}`,
                requestMediaType,
                String(status),
                responseMediaType,
              ]);
              const selector = render(
                method,
                path,
                requestMediaType,
                status,
                responseMediaType,
              );
              const previous = seen.get(selector);

              if (previous !== undefined) {
                expect(previous, `collision on ${selector}`).toBe(identity);
              }

              seen.set(selector, identity);
            }
          }
        }
      }
    }
  });
});
