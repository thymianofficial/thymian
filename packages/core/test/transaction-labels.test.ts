import { describe, expect, it } from 'vitest';

import type { ThymianHttpRequest } from '../src/format/nodes/http-request.node.js';
import type { ThymianHttpResponse } from '../src/format/nodes/http-response.node.js';
import {
  thymianHttpTransactionToString,
  thymianRequestToString,
  thymianResponseToString,
} from '../src/utils.js';

function request(
  overrides: Partial<ThymianHttpRequest> = {},
): ThymianHttpRequest {
  return {
    type: 'http-request',
    label: 'unused',
    host: 'api.example.com',
    port: 443,
    protocol: 'https',
    path: '/launches/{id}',
    method: 'post',
    headers: {},
    queryParameters: {},
    cookies: {},
    pathParameters: {},
    mediaType: 'application/json',
    ...overrides,
  };
}

function response(
  overrides: Partial<ThymianHttpResponse> = {},
): ThymianHttpResponse {
  return {
    type: 'http-response',
    label: 'unused',
    statusCode: 201,
    mediaType: 'application/json',
    headers: {},
    ...overrides,
  };
}

/**
 * ADR-0020: one grammar for one concept. These assert what a *reader* gets —
 * that the string under their cursor is the string a hook is anchored to — not
 * how the renderer is wired.
 */
describe('the label of a transaction', () => {
  it('is the transaction selector, verbatim', () => {
    expect(thymianHttpTransactionToString(request(), response())).toBe(
      'POST /launches/{id} (application/json) -> 201 (application/json)',
    );
  });

  it('carries no reason phrase', () => {
    const label = thymianHttpTransactionToString(
      request({ mediaType: '' }),
      response({ statusCode: 409, mediaType: '' }),
    );

    expect(label).toBe('POST /launches/{id} -> 409');
    expect(label).not.toMatch(/CONFLICT/i);
  });

  it('is host-stripped, so the same operation on two servers reads the same', () => {
    const label = thymianHttpTransactionToString(
      request({ host: 'staging.example.com', port: 8080, protocol: 'http' }),
      response(),
    );

    expect(label).toBe(
      'POST /launches/{id} (application/json) -> 201 (application/json)',
    );
  });

  it('spells a media part whenever the node declares a media type', () => {
    expect(
      thymianHttpTransactionToString(
        request({ method: 'DELETE', mediaType: '' }),
        response({ statusCode: 204, mediaType: '' }),
      ),
    ).toBe('DELETE /launches/{id} -> 204');
  });
});

describe('a label that names only one half of a transaction', () => {
  it('uses the request half of the grammar', () => {
    expect(thymianRequestToString(request())).toBe(
      'POST /launches/{id} (application/json)',
    );
  });

  it('uses the response half of the grammar', () => {
    expect(thymianResponseToString(response())).toBe('201 (application/json)');
  });

  it('composes into the whole, so there is one grammar and not three', () => {
    const req = request({ method: 'get', path: 'astronauts', mediaType: '' });
    const res = response({ statusCode: 200 });

    expect(thymianHttpTransactionToString(req, res)).toBe(
      `${thymianRequestToString(req)} -> ${thymianResponseToString(res)}`,
    );
  });

  it('stays printable for an odd-but-legal description', () => {
    const req = request({
      method: 'GE T',
      path: '/a b/c->d',
      mediaType: 'text/plain; format="a(b)"',
    });

    expect(thymianRequestToString(req)).toBe(
      '"GE T" "/a b/c->d" (text/plain; format="a(b)")',
    );
  });
});
