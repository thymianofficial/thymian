import { httpRule, type RuleFnResult, ThymianFormat } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { checkInput, type FixtureExpectation } from '../src/index.js';

const name = 'rules-testing/answers-as-told';

const violation: RuleFnResult = {
  location: 'here',
  violation: { message: 'flagged' },
  findings: [],
};

const skip: RuleFnResult = {
  location: 'here',
  findings: [{ kind: 'rule-skip', title: name, message: 'undecidable' }],
};

// A skip that names another rule is not this rule's skip.
const foreignSkip: RuleFnResult = {
  location: 'here',
  findings: [{ kind: 'rule-skip', title: 'some/other-rule' }],
};

const pass: RuleFnResult = { location: 'here', findings: [] };

// A rule that reports exactly what it is told to, so each verdict is checked
// against a known set of results.
function answering(results: RuleFnResult[]) {
  return httpRule(name)
    .severity('error')
    .type('static')
    .rule(() => results)
    .done();
}

const input = { format: new ThymianFormat() };

async function verdict(results: RuleFnResult[], expected: FixtureExpectation) {
  return checkInput('static', answering(results), input, expected);
}

describe('checkInput', () => {
  describe.each<[FixtureExpectation, RuleFnResult[][], RuleFnResult[][]]>([
    ['violates', [[violation], [violation, skip]], [[], [pass], [skip]]],
    [
      'conforms',
      [[], [pass], [foreignSkip]],
      [[violation], [skip], [pass, skip]],
    ],
    ['skips', [[skip], [pass, skip]], [[], [pass], [violation, skip]]],
  ])('expecting %s', (expected, keeps, breaks) => {
    it.each(keeps)('is met by %j', async (...results) => {
      await expect(verdict(results, expected)).resolves.toEqual({
        met: true,
        results,
      });
    });

    it.each(breaks)('is not met by %j', async (...results) => {
      const { met, reason } = await verdict(results, expected);

      expect(met).toBe(false);
      expect(reason).toContain(`\`${expected}\` input`);
    });
  });

  it('says what it saw when a promise is broken', async () => {
    const { reason, results } = await verdict([skip, pass], 'violates');

    expect(reason).toBe(
      `the \`violates\` input of ${name} in \`static\` should be flagged, ` +
        'but it got 0 violations and 1 skip in 2 results',
    );
    expect(results).toEqual([skip, pass]);
  });

  it('rejects, rather than resolves unmet, when the run itself fails', async () => {
    const rule = httpRule('rules-testing/throws')
      .severity('error')
      .type('static')
      .rule(() => {
        throw new Error('boom');
      })
      .done();

    await expect(checkInput('static', rule, input, 'conforms')).rejects.toThrow(
      'boom',
    );
  });
});
