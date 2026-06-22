import type { RuleFnResult, RuleViolationLocation } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import requestBodyRule from '../src/rules/request-body-conforms-to-schema.rule.js';
import requestHeadersRule from '../src/rules/request-headers-conform-to-schema.rule.js';
import requestPathParametersRule from '../src/rules/request-path-parameters-conform-to-schema.rule.js';
import requestQueryParametersRule from '../src/rules/request-query-parameters-conform-to-schema.rule.js';
import responseBodyRule from '../src/rules/response-body-conforms-to-schema.rule.js';
import responseHeadersRule from '../src/rules/response-headers-conform-to-schema.rule.js';

// Minimal stand-in for AnalyzeContext — only the surface these guard branches touch.
type MinimalAnalyzeCtx = {
  format: { getThymianHttpTransactionById: (id: string) => unknown };
  validateHttpTransactions: (
    filter: unknown,
    fn: (
      req: unknown,
      res: unknown,
      location: RuleViolationLocation,
    ) => RuleFnResult[],
  ) => RuleFnResult[];
};

function makeCtx(
  location: RuleViolationLocation,
  txExists = false,
): MinimalAnalyzeCtx {
  return {
    format: {
      // Arrow function with fewer parameters is assignable — the id is not needed here.
      getThymianHttpTransactionById: () => (txExists ? {} : undefined),
    },
    // Invoke the validation function directly with the controlled location.
    // req/res are unused by both guard branches, so empty objects suffice.
    validateHttpTransactions: (_filter, fn) => fn({}, {}, location),
  };
}

const rules = [
  {
    ruleName: 'request-body-conforms-to-schema',
    ruleTitle: 'thymian/request-body-must-conform-to-schema',
    rule: requestBodyRule,
  },
  {
    ruleName: 'request-headers-conform-to-schema',
    ruleTitle: 'thymian/request-headers-must-conform-to-schema',
    rule: requestHeadersRule,
  },
  {
    ruleName: 'request-path-parameters-conform-to-schema',
    ruleTitle: 'thymian/request-path-parameters-must-conform-to-schema',
    rule: requestPathParametersRule,
  },
  {
    ruleName: 'request-query-parameters-conform-to-schema',
    ruleTitle: 'thymian/request-query-parameters-must-conform-to-schema',
    rule: requestQueryParametersRule,
  },
  {
    ruleName: 'response-body-conforms-to-schema',
    ruleTitle: 'thymian/response-body-must-conforms-to-schema',
    rule: responseBodyRule,
  },
  {
    ruleName: 'response-headers-conform-to-schema',
    ruleTitle: 'thymian/response-headers-must-conform-to-schema',
    rule: responseHeadersRule,
  },
];

describe.each(rules)('rule-skip guards: $ruleName', ({ ruleTitle, rule }) => {
  // All rules in this table are analytics rules, so analyzeRule is always defined.
  // The runtime check below provides a clear failure message if that ever changes.
  function getAnalyzeRule() {
    const { analyzeRule } = rule;
    if (!analyzeRule) {
      throw new Error(`Expected ${ruleTitle} to have an analyzeRule function`);
    }
    return (ctx: MinimalAnalyzeCtx) => analyzeRule(ctx as never);
  }

  it('emits a rule-skip finding when the location is a string (no matching endpoint in API description)', async () => {
    const ctx = makeCtx('GET /users');

    const results = await getAnalyzeRule()(ctx);

    expect(results).toHaveLength(1);
    expect(results[0].findings).toHaveLength(1);
    expect(results[0].findings[0]).toMatchObject({
      kind: 'rule-skip',
      title: ruleTitle,
      message:
        'No matching endpoint found in corresponding API description document.',
    });
  });

  it('emits a rule-skip finding when no transaction is found for the given ID', async () => {
    const txId = 'tx-abc-1';
    const location: RuleViolationLocation = {
      elementType: 'edge',
      elementId: txId,
    };
    const ctx = makeCtx(location, false);

    const results = await getAnalyzeRule()(ctx);

    expect(results).toHaveLength(1);
    expect(results[0].findings).toHaveLength(1);
    expect(results[0].findings[0]).toMatchObject({
      kind: 'rule-skip',
      title: ruleTitle,
      message: `Can't find transaction with given ID ${txId} in Thymian format.`,
    });
  });
});
