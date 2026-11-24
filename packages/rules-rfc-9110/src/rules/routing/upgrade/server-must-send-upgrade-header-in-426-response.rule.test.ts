import { type HttpResponse, type RuleFnResult } from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { runTestRuleCases } from '../../../../test/run-test-rule.js';
import rule from './server-must-send-upgrade-header-in-426-response.rule.js';

const described = {
  req: createHttpRequest({ method: 'get', path: '/rocket-types' }),
  res: createHttpResponse({ statusCode: 426 }),
};

async function runTest(response: HttpResponse): Promise<RuleFnResult[]> {
  return (await runTestRuleCases(rule, described, response)).results;
}

describe('rfc9110/server-must-send-upgrade-header-in-426-response (test)', () => {
  it('reports no violation when the live 426 response carries Upgrade', async () => {
    const results = await runTest({
      statusCode: 426,
      headers: { upgrade: 'HTTP/2.0' },
      trailers: {},
      duration: 0,
    });

    expect(results).toEqual([]);
  });

  it('is not applicable, without a violation, when the server answers with another status', async () => {
    const { results, rejectedCases } = await runTestRuleCases(rule, described, {
      statusCode: 200,
      headers: {},
      trailers: {},
      duration: 0,
    });

    // Not applicable to the live pair: nothing returned, the case is
    // notApplicable with the reason (ADR-0028, ADR-0030).
    expect(results).toEqual([]);
    expect(rejectedCases).toMatchObject([
      {
        reason: expect.stringContaining(
          'the specification declares 426, the server answered 200',
        ),
      },
    ]);
  });

  it('reports a violation when the live 426 response omits Upgrade', async () => {
    const results = await runTest({
      statusCode: 426,
      headers: {},
      trailers: {},
      duration: 0,
    });

    expect(results).toHaveLength(1);
  });
});
