import {
  type AnalyzeContext,
  NoopLogger,
  type Rule,
  type RuleFnResult,
  type RuleViolationLocation,
} from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import requestBodyRule from '../src/rules/request-body-conforms-to-schema.rule.js';
import requestHeadersRule from '../src/rules/request-headers-conform-to-schema.rule.js';
import requestPathParametersRule from '../src/rules/request-path-parameters-conform-to-schema.rule.js';
import requestQueryParametersRule from '../src/rules/request-query-parameters-conform-to-schema.rule.js';
import responseBodyRule from '../src/rules/response-body-conforms-to-schema.rule.js';
import responseHeadersRule from '../src/rules/response-headers-conform-to-schema.rule.js';

const RULES: { rule: Rule; title: string }[] = [
  {
    rule: requestBodyRule,
    title: 'thymian/request-body-must-conform-to-schema',
  },
  {
    rule: requestHeadersRule,
    title: 'thymian/request-headers-must-conform-to-schema',
  },
  {
    rule: requestPathParametersRule,
    title: 'thymian/request-path-parameters-must-conform-to-schema',
  },
  {
    rule: requestQueryParametersRule,
    title: 'thymian/request-query-parameters-must-conform-to-schema',
  },
  {
    // Intentional: the rule was named with "conforms" (not "conform") — assert exact string.
    rule: responseBodyRule,
    title: 'thymian/response-body-must-conforms-to-schema',
  },
  {
    rule: responseHeadersRule,
    title: 'thymian/response-headers-must-conform-to-schema',
  },
];

function makeStubCtx(location: RuleViolationLocation): AnalyzeContext<unknown> {
  const request = createHttpRequest();
  const response = createHttpResponse();

  return {
    format: {
      getThymianHttpTransactionById: () => undefined,
    },
    validateHttpTransactions: (_filter: unknown, fn: unknown): RuleFnResult[] =>
      (
        fn as (
          req: unknown,
          res: unknown,
          loc: RuleViolationLocation,
        ) => RuleFnResult[]
      )(request, response, location),
  } as unknown as AnalyzeContext<unknown>;
}

describe.each(RULES)(
  'conforms-to-schema rule guard findings — $title',
  ({ rule, title }) => {
    it('returns a rule-skip finding when location is a string (no matching endpoint)', async () => {
      const stringLocation: RuleViolationLocation = 'unmatched-endpoint';
      const ctx = makeStubCtx(stringLocation);

      const result = await rule.analyzeRule!(
        ctx,
        { mode: 'analytics' },
        new NoopLogger(),
      );

      expect(result).toHaveLength(1);
      expect(result[0].violation).toBeUndefined();
      expect(result[0].location).toBe('unmatched-endpoint');
      expect(result[0].findings).toHaveLength(1);
      expect(result[0].findings[0].kind).toBe('rule-skip');
      expect(result[0].findings[0].title).toBe(title);
      expect(result[0].findings[0].message).toBe(
        'No matching endpoint found in corresponding API description document.',
      );
    });

    it('returns a rule-skip finding when transaction is not found in Thymian format', async () => {
      const objectLocation: RuleViolationLocation = {
        elementType: 'edge',
        elementId: 'missing-tx',
        pointer: '',
      };
      const ctx = makeStubCtx(objectLocation);

      const result = await rule.analyzeRule!(
        ctx,
        { mode: 'analytics' },
        new NoopLogger(),
      );

      expect(result).toHaveLength(1);
      expect(result[0].violation).toBeUndefined();
      expect(result[0].location).toEqual(objectLocation);
      expect(result[0].findings).toHaveLength(1);
      expect(result[0].findings[0].kind).toBe('rule-skip');
      expect(result[0].findings[0].title).toBe(title);
      expect(result[0].findings[0].message).toBe(
        "Can't find transaction with given ID missing-tx in Thymian format.",
      );
    });
  },
);
