import { type HttpResponse, type RuleFnResult } from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { runTestRuleCases } from '../../../../test/run-test-rule.js';
import rule from './sender-should-indicate-complete-length-for-byte-ranges.rule.js';

const described = {
  req: createHttpRequest({ method: 'get', path: '/rocket-types' }),
  res: createHttpResponse({ statusCode: 206 }),
};

async function runTest(response: HttpResponse): Promise<RuleFnResult[]> {
  return (await runTestRuleCases(rule, described, response)).results;
}

describe('rfc9110/sender-should-indicate-complete-length-for-byte-ranges (test)', () => {
  it('is not applicable, without a violation, when the server answers the full representation with 200', async () => {
    const { results, rejectedCases } = await runTestRuleCases(rule, described, {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      trailers: {},
      duration: 0,
    });

    // Not applicable to the live pair: nothing returned, the case is
    // notApplicable with the reason (ADR-0028, ADR-0030).
    expect(results).toEqual([]);
    expect(rejectedCases).toMatchObject([
      {
        reason: expect.stringContaining(
          'the specification declares 206, the server answered 200',
        ),
      },
    ]);
  });

  it('reports no violation when the live 206 response indicates the complete length', async () => {
    const results = await runTest({
      statusCode: 206,
      headers: { 'content-range': 'bytes 0-1023/8192' },
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('reports a violation when the live 206 response omits Content-Range', async () => {
    const results = await runTest({
      statusCode: 206,
      headers: {},
      trailers: {},
      duration: 0,
    });

    expect(results).toHaveLength(1);
  });
});
