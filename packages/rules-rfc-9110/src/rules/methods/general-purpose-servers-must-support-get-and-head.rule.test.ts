import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { runTestRuleCases } from '../../../test/run-test-rule.js';
import rule from './general-purpose-servers-must-support-get-and-head.rule.js';

// The description declares only a 200: it never documents the 501 the rule
// forbids.
const described = {
  req: createHttpRequest({ method: 'get', path: '/rockets' }),
  res: createHttpResponse({ statusCode: 200 }),
};

function live(statusCode: number) {
  return { statusCode, headers: {}, trailers: {}, duration: 0 };
}

describe('rfc9110/general-purpose-servers-must-support-get-and-head (test)', () => {
  it('fails a live 501 to GET that the description does not declare', async () => {
    const { cases } = await runTestRuleCases(rule, described, live(501));

    expect(cases.map((c) => c.status)).toEqual(['failed']);
  });

  it('passes a live 200 to GET', async () => {
    const { cases } = await runTestRuleCases(rule, described, live(200));

    expect(cases.map((c) => c.status)).toEqual(['passed']);
  });
});
