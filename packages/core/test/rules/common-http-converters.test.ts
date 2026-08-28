import { describe, expect, it } from 'vitest';

import type { HttpResponse } from '../../src/http.js';
import { httpResponseToCommonHttpResponse } from '../../src/rules/common-http-converters.js';

function response(overrides: Partial<HttpResponse> = {}): HttpResponse {
  return {
    statusCode: 200,
    headers: {},
    trailers: {},
    duration: 0,
    ...overrides,
  };
}

describe('httpResponseToCommonHttpResponse', () => {
  it('reports the full media type for a string-valued content-type', () => {
    const common = httpResponseToCommonHttpResponse(
      response({ headers: { 'content-type': 'application/json' } }),
    );

    // The previous `?.at(0)` indexed into the STRING, yielding 'a'.
    expect(common.mediaType).toBe('application/json');
  });

  it('reports the first element for an array-valued content-type', () => {
    const common = httpResponseToCommonHttpResponse(
      response({
        headers: { 'content-type': ['application/json', 'text/plain'] },
      }),
    );

    expect(common.mediaType).toBe('application/json');
  });

  it('reports an empty media type when content-type is absent', () => {
    expect(httpResponseToCommonHttpResponse(response()).mediaType).toBe('');
  });

  it('does not throw on case-variant duplicate content-type keys', () => {
    const common = httpResponseToCommonHttpResponse(
      response({
        headers: {
          'Content-Type': 'application/json',
          'content-type': 'text/plain',
        },
      }),
    );

    // getHeader merges the duplicates, so this is the array path -- first
    // element wins, and conversion of anomalous captured traffic never
    // crashes the analyze context.
    expect(common.mediaType).toBe('application/json');
  });
});
