import {
  createHttpRequest,
  createHttpResponse,
  createObjectSchema,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { runTestRule } from '../../../../test/run-test-rule.js';
import rule from './origin-server-should-send-content-length-when-size-known.rule.js';

const described = {
  req: createHttpRequest({ method: 'get', path: '/rocket-types' }),
  res: createHttpResponse({ statusCode: 200, schema: createObjectSchema() }),
};

describe('rfc9110/origin-server-should-send-content-length-when-size-known (test)', () => {
  it('reports no violation when the live response carries a Content-Length header', async () => {
    const results = await runTestRule(rule, described, {
      statusCode: 200,
      headers: { 'content-length': '2' },
      trailers: {},
      duration: 0,
      body: '{}',
    });

    expect(results).toEqual([]);
  });

  it('reports a violation when the live response has a body with neither Content-Length nor Transfer-Encoding', async () => {
    const results = await runTestRule(rule, described, {
      statusCode: 200,
      headers: {},
      trailers: {},
      duration: 0,
      body: '{}',
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.violation?.message).toBe(
      'The response carries content with no Transfer-Encoding and no Content-Length header.',
    );
  });
});
