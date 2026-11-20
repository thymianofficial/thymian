import { describe, expectTypeOf, it } from 'vitest';

import {
  type ApiContext,
  type LintContext,
  type LiveApiContext,
  responseHeader,
  type RuleFn,
  type RuleFnResult,
  type RuleViolationGroupLocation,
  type RuleViolationLocation,
  statusCode,
} from '../../src/index.js';

declare const api: ApiContext;
declare const live: LiveApiContext;
declare const lint: LintContext;

type Results = Promise<RuleFnResult[]> | RuleFnResult[];
type GroupedResults =
  | Promise<RuleFnResult<RuleViolationLocation | RuleViolationGroupLocation>[]>
  | RuleFnResult<RuleViolationLocation | RuleViolationGroupLocation>[];

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
    ).toEqualTypeOf<GroupedResults>();
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

describe('a group location in what a rule returns', () => {
  const handBuilt = {
    elementType: 'group' as const,
    key: '/users',
    members: [] as RuleViolationLocation[],
  };

  it('cannot be made in a grouped violatedWhen', () => {
    api.validateGroupedCommonHttpTransactions({
      appliesTo: statusCode(405),
      groupBy: statusCode(),
      violatedWhen: () => [
        // @ts-expect-error a rule cannot make a group location
        { location: handBuilt, findings: [] },
      ],
    });
  });

  it('cannot be made in an ungrouped violatedWhen', () => {
    // @ts-expect-error a rule cannot make a group location
    live.validateHttpTransactions({
      appliesTo: statusCode(405),
      violatedWhen: () => [{ location: handBuilt, findings: [] }],
    });
  });

  it('cannot be made in a rule body', () => {
    const rule: RuleFn<ApiContext, Record<string, never>> = () => [
      // @ts-expect-error a rule cannot make a group location
      { location: handBuilt, findings: [] },
    ];

    expectTypeOf(rule).toBeFunction();
  });
});
