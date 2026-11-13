import type { Rule, ThymianFormat } from '@thymian/core';

import type { RuleTestExecution } from './rule-test-execution.js';
import { ruleUnderTest } from './rule-under-test.js';
import { runLint } from './run-lint.js';

/**
 * One method per validation context a rule can declare.
 */
export type RuleTester = {
  /**
   * Runs the rule as `thymian lint` does and returns one execution per
   * transaction of the format, in the order the transactions were added,
   * followed by the executions the engine located anywhere else.
   *
   * Throws when the rule does not declare `static`.
   */
  runLint(format: ThymianFormat): Promise<RuleTestExecution[]>;
};

/**
 * How the rule is configured for the run.
 */
export type RuleTesterConfiguration<
  Options extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>,
> = {
  /**
   * The rule's options, handed to the rule function as the `options` of the
   * rule's entry in a config are. Call `createRuleTester` once per configuration to
   * test. `createRuleTester` throws when the rule's options schema does not accept
   * them.
   */
  options?: Options;
};

/**
 * Tests a rule through the real engine of a validation context it declares.
 *
 * The rule runs whatever severity it ships with, `off` included, and a
 * `failed` execution carries the severity the rule declares.
 *
 * @example
 * ```typescript
 * const format = createThymianFormat();
 * const launchCreated = addTransaction(
 *   format,
 *   createPostRequest({ path: '/launches' }),
 *   createCreatedResponse(),
 * );
 *
 * expect(await createRuleTester(createdResponsesHaveLocation).runLint(format)).toMatchObject([
 *   { location: { elementId: launchCreated }, status: 'failed' },
 * ]);
 * ```
 */
export function createRuleTester<Options extends Record<PropertyKey, unknown>>(
  rule: Rule<Options>,
  { options }: RuleTesterConfiguration<Options> = {},
): RuleTester {
  // A rule's options type is fixed by its own schema; the engines take rules
  // of any options type the same way.
  const anyRule = rule as unknown as Rule;
  const underTest = ruleUnderTest(anyRule, options);

  return {
    async runLint(format) {
      assertDeclares(anyRule, 'runLint', 'static');
      return runLint(underTest, format);
    },
  };
}

function assertDeclares(
  rule: Rule,
  method: keyof RuleTester,
  context: 'static',
): void {
  if (!rule.meta.type.includes(context)) {
    throw new Error(
      `${method} runs a rule in "${context}", and rule "${rule.meta.name}" does not declare it. It declares: ${rule.meta.type.join(', ')}.`,
    );
  }
}
