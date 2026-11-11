// What a fixture promises, and whether an input keeps that promise. The
// discovery of fixture modules and the fixture bar stay with each rule set,
// in whatever test framework it uses.

import type { Rule, RuleFnResult } from '@thymian/core';

import type { ObservedInput } from './observed.js';
import {
  type InputOf,
  runInContext,
  type ValidationContext,
  validationContexts,
} from './run-in-context.js';

/**
 * One context's fixture: an input the rule must flag, and one it must pass.
 * `skips` is for a rule that declares a context but cannot decide every input
 * in it, and must say so with a `rule-skip` rather than pass silently.
 */
export type ContextFixture<Context extends ValidationContext> = {
  violates: InputOf<Context>;
  conforms: InputOf<Context>;
  skips?: InputOf<Context>;
};

/**
 * One fixture module's default export: the rule, and one fixture per context
 * it declares.
 */
export type RuleFixtures = { rule: Rule } & {
  [Context in ValidationContext]?: ContextFixture<Context>;
};

/**
 * One fixture for every context `rule` declares, each made of the same
 * `observed` lists: for an assertion every context makes alike. `skips`,
 * when given, goes into every context too. To give one context other inputs,
 * spread the result and override that context's entry.
 */
export function inDeclaredContexts(
  rule: Rule,
  inputs: {
    violates: ObservedInput;
    conforms: ObservedInput;
    skips?: ObservedInput;
  },
): RuleFixtures {
  const { violates, conforms, skips } = inputs;
  const fixture =
    skips === undefined
      ? { violates, conforms }
      : { violates, conforms, skips };

  const fixtures: RuleFixtures = { rule };
  for (const context of validationContexts) {
    if (rule.meta.type.includes(context)) {
      fixtures[context] = { ...fixture };
    }
  }
  return fixtures;
}

/** The promise an input makes: the name of its `ContextFixture` field. */
export type FixtureExpectation = 'violates' | 'conforms' | 'skips';

export type FixtureVerdict = {
  met: boolean;
  /** Why the promise was broken; absent when it was kept. */
  reason?: string;
  results: RuleFnResult[];
};

const promises: Record<FixtureExpectation, string> = {
  violates: 'be flagged',
  conforms: 'pass, without a violation or a skip',
  skips: 'be skipped, without a violation',
};

/**
 * Runs `input` through `context`'s real engine and says whether it kept the
 * promise `expected` makes:
 *
 * - `violates`: at least one violation.
 * - `conforms`: no violation and no skip.
 * - `skips`: no violation and at least one skip, a `rule-skip` finding whose
 *   title is the rule's name.
 *
 * A broken promise resolves with `met: false`; it rejects only when
 * `runInContext` does.
 */
export async function checkInput<Context extends ValidationContext>(
  context: Context,
  rule: Rule,
  input: InputOf<Context>,
  expected: FixtureExpectation,
): Promise<FixtureVerdict> {
  const results = await runInContext(context, rule, input);

  const violations = results.filter(
    (result) => result.violation !== undefined,
  ).length;
  const skips = results.filter((result) =>
    result.findings.some(
      (finding) =>
        finding.kind === 'rule-skip' && finding.title === rule.meta.name,
    ),
  ).length;

  const met =
    expected === 'violates'
      ? violations > 0
      : violations === 0 && (expected === 'skips' ? skips > 0 : skips === 0);

  if (met) {
    return { met, results };
  }

  return {
    met,
    reason:
      `the \`${expected}\` input of ${rule.meta.name} in \`${context}\` should ` +
      `${promises[expected]}, but it got ${count(violations, 'violation')} ` +
      `and ${count(skips, 'skip')} in ${count(results.length, 'result')}`,
    results,
  };
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
