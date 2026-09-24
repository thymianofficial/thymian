import { constant, httpRule } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { apiDescription } from './builders.js';
import { runInContext } from './harness.js';

// The one harness property no fixture shows until a convention rule ships:
// `runRules` skips an `off` rule by design, so the harness must turn it on or
// a convention rule's fixture would pass by never running.
describe('the fixture harness', () => {
  it('runs a rule shipped off at warn', async () => {
    const rule = httpRule('rfc-6797/fixture-harness-off-rule')
      .severity('off')
      .type('static')
      .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
      .done();

    const results = await runInContext('static', rule, {
      format: apiDescription({}),
    });

    expect(results.filter((result) => result.violation !== undefined)).toEqual([
      expect.objectContaining({ violation: {} }),
    ]);
  });
});
