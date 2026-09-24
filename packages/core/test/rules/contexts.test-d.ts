import { describe, expectTypeOf, it } from 'vitest';

import {
  type ApiContext,
  type LintContext,
  type LiveApiContext,
  responseHeader,
  type RuleFnResult,
  statusCode,
} from '../../src/index.js';

declare const api: ApiContext;
declare const live: LiveApiContext;
declare const lint: LintContext;

type Results = Promise<RuleFnResult[]> | RuleFnResult[];

describe('the { appliesTo, violatedWhen } form of rule-context validation calls', () => {
  it('accepts both keys', () => {
    expectTypeOf(
      api.validateCommonHttpTransactions({
        appliesTo: statusCode(405),
        violatedWhen: responseHeader('allow'),
      }),
    ).toEqualTypeOf<Results>();
    expectTypeOf(
      live.validateHttpTransactions({
        appliesTo: statusCode(405),
        violatedWhen: (_req, _res, location) => [
          { location, violation: {}, findings: [] },
        ],
      }),
    ).toEqualTypeOf<Results>();
    expectTypeOf(
      api.validateGroupedCommonHttpTransactions({
        appliesTo: statusCode(405),
        groupBy: statusCode(),
        violatedWhen: () => [],
      }),
    ).toEqualTypeOf<Results>();
    expectTypeOf(
      lint.validateHttpTransactions({
        appliesTo: (_req, res) => res.statusCode === 405,
        violatedWhen: () => true,
      }),
    ).toEqualTypeOf<Results>();
  });

  it('rejects a call without appliesTo', () => {
    // @ts-expect-error appliesTo is required
    api.validateCommonHttpTransactions({
      violatedWhen: responseHeader('allow'),
    });
    // @ts-expect-error appliesTo is required
    live.validateHttpTransactions({ violatedWhen: responseHeader('allow') });
    // @ts-expect-error appliesTo is required
    api.validateGroupedCommonHttpTransactions({
      groupBy: statusCode(),
      violatedWhen: () => [],
    });
    // @ts-expect-error appliesTo is required
    lint.validateHttpTransactions({ violatedWhen: () => true });
  });

  it('rejects a call without violatedWhen', () => {
    // @ts-expect-error violatedWhen is required
    api.validateCommonHttpTransactions({ appliesTo: statusCode(405) });
    // @ts-expect-error violatedWhen is required
    live.validateHttpTransactions({ appliesTo: statusCode(405) });
    // @ts-expect-error violatedWhen is required
    api.validateGroupedCommonHttpTransactions({
      appliesTo: statusCode(405),
      groupBy: statusCode(),
    });
    // @ts-expect-error violatedWhen is required
    lint.validateHttpTransactions({ appliesTo: () => true });
  });
});
