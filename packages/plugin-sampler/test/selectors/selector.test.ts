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

  it('percent-encodes only what would collide with the grammar', () => {
    expect(encodePath('/a b')).toBe('/a%20b');
    expect(encodePath('/a->b')).toBe('/a-%3Eb');
    // Everything else survives: braces, parentheses, existing encoding, a
    // trailing slash and a base path.
    expect(encodePath('/v1/users/{userId}/(x)/a%20b/')).toBe(
      '/v1/users/{userId}/(x)/a%20b/',
    );
    expect(encodeMethod('GE T')).toBe('GE%20T');
    expect(encodeMethod('report')).toBe('REPORT');
  });

  it('preserves quoted-string media parameters, parentheses included', () => {
    expect(encodeMediaType('text/plain; format="a(b)"')).toBe(
      'text/plain; format="a(b)"',
    );
    // A bare parenthesis is not a legal token character, so it is escaped
    // rather than allowed to shadow a media group delimiter.
    expect(encodeMediaType('text/plain; format=a(b)')).toBe(
      'text/plain; format=a%28b%29',
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
