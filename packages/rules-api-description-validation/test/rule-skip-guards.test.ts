import {
  type HttpRequest,
  type HttpResponse,
  type RuleFnResult,
  type RuleViolationLocation,
  ThymianFormat,
} from '@thymian/core';
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
  validateHttpTransactions: (options: {
    appliesTo: unknown;
    violatedWhen: (
      req: unknown,
      res: unknown,
      location: RuleViolationLocation,
    ) => RuleFnResult[];
  }) => RuleFnResult[];
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
    validateHttpTransactions: ({ violatedWhen }) =>
      violatedWhen({}, {}, location),
  };
}

const requestRules = [
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
];

const responseRules = [
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

const rules = [...requestRules, ...responseRules];

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

// An Undocumented Response reaches a rule as a node location on the matched
// request node (ADR-0027). These cases run the rules against a real format.
describe('undocumented response (node location on the request node)', () => {
  const format = new ThymianFormat();
  const [requestId, , transactionId] = format.addHttpTransaction(
    {
      type: 'http-request',
      host: 'api.example.com',
      port: 443,
      protocol: 'https',
      path: '/v2/clock/{id}',
      method: 'post',
      headers: {
        'x-api-key': { required: true, schema: { type: 'string' } },
      },
      queryParameters: {
        tz: { required: true, schema: { type: 'string' } },
      },
      cookies: {},
      pathParameters: {
        id: { required: true, schema: { type: 'integer' } },
      },
      mediaType: 'application/json',
      body: {
        type: 'object',
        required: ['time'],
        properties: { time: { type: 'string' } },
      },
    },
    {
      type: 'http-response',
      headers: {},
      mediaType: 'application/json',
      statusCode: 200,
    },
    'test-source',
  );

  // Violates every request rule: no header, no query, a non-integer path
  // parameter and a body without `time`.
  const request: HttpRequest = {
    origin: 'https://api.example.com',
    path: '/v2/clock/abc',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  };
  const response: HttpResponse = {
    statusCode: 418,
    headers: { 'content-type': 'application/json' },
    body: '{}',
    trailers: {},
    duration: 0,
  };

  function run(
    rule: (typeof rules)[number]['rule'],
    location: RuleViolationLocation,
  ) {
    const ctx = {
      format,
      validateHttpTransactions: ({
        violatedWhen,
      }: {
        violatedWhen: (
          req: HttpRequest,
          res: HttpResponse,
          location: RuleViolationLocation,
        ) => RuleFnResult[];
      }) => violatedWhen(request, response, location),
    };

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return rule.analyzeRule!(ctx as never) as Promise<RuleFnResult[]>;
  }

  const nodeLocation: RuleViolationLocation = {
    elementType: 'node',
    elementId: requestId,
  };

  it.each(requestRules)(
    '$ruleName reports the same as for a documented response',
    async ({ rule }) => {
      const documented = await run(rule, {
        elementType: 'edge',
        elementId: transactionId,
      });
      const undocumented = await run(rule, nodeLocation);

      expect(documented[0]?.violation).toBeDefined();
      expect(
        undocumented.map(({ violation, findings }) => ({
          violation,
          findings,
        })),
      ).toEqual(
        documented.map(({ violation, findings }) => ({ violation, findings })),
      );
      expect(undocumented[0]?.location).toEqual(nodeLocation);
    },
  );

  it.each(responseRules)(
    '$ruleName skips naming the undocumented response and its operation',
    async ({ rule, ruleTitle }) => {
      const results = await run(rule, nodeLocation);

      expect(results).toEqual([
        {
          location: nodeLocation,
          findings: [
            {
              kind: 'rule-skip',
              title: ruleTitle,
              message:
                'Skipped: the response 418 (application/json) is not documented in the API specification for POST /v2/clock/{id} (application/json).',
            },
          ],
        },
      ]);
    },
  );

  it.each(rules)(
    '$ruleName skips when the node location names no request',
    async ({ rule, ruleTitle }) => {
      const results = await run(rule, {
        elementType: 'node',
        elementId: 'missing',
      });

      expect(results[0]?.findings).toEqual([
        {
          kind: 'rule-skip',
          title: ruleTitle,
          message:
            "Can't find request with given ID missing in Thymian format.",
        },
      ]);
    },
  );
});
