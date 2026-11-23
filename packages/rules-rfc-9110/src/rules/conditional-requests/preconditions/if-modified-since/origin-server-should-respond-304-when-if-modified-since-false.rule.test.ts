import { getHeader, type HttpRequest } from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { runTestRuleCases } from '../../../../../test/run-test-rule.js';
import rule from './origin-server-should-respond-304-when-if-modified-since-false.rule.js';

const LAST_MODIFIED = 'Tue, 15 Nov 1994 12:45:26 GMT';

const described = {
  req: createHttpRequest({ method: 'get', path: '/rockets' }),
  res: createHttpResponse({ statusCode: 200 }),
};

// Answers the seeding request with the declared 200 and the replay, which
// carries If-Modified-Since, with `replayStatus`.
function server(replayStatus: number, seedStatus = 200) {
  return (request: HttpRequest) => ({
    statusCode:
      getHeader(request.headers ?? {}, 'if-modified-since') === undefined
        ? seedStatus
        : replayStatus,
    headers: { 'last-modified': LAST_MODIFIED },
    trailers: {},
    duration: 0,
  });
}

describe('rfc9110/origin-server-should-respond-304-when-if-modified-since-false (test)', () => {
  it('passes when the replay is answered with the 304 it expects', async () => {
    const { results, cases } = await runTestRuleCases(
      rule,
      described,
      server(304),
    );

    expect(cases.map((c) => c.status)).toEqual(['passed']);
    expect(results).toEqual([]);
  });

  it('reports a replay answered with 200 instead of 304', async () => {
    const { results } = await runTestRuleCases(rule, described, server(200));

    expect(results).toEqual([
      expect.objectContaining({ violation: expect.any(Object) }),
    ]);
  });

  it('keeps the seeding step gated on the declared status', async () => {
    const { cases } = await runTestRuleCases(rule, described, server(304, 500));

    expect(cases.map((c) => c.status)).toEqual(['skipped']);
  });
});
