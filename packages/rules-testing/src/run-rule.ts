import type { Rule, ThymianFormat } from '@thymian/core';

import type { RuleTestExecution } from './rule-test-execution.js';
import { ruleUnderTest } from './rule-under-test.js';
import { runStatic } from './run-static.js';

/**
 * One function per validation context, named as in the rule's `.type(...)`.
 */
export type RunRule = {
  /**
   * Runs the rule as `thymian lint` does and returns one execution per
   * transaction of the format, in the order the transactions were added,
   * followed by the executions the engine located anywhere else.
   *
   * Throws when the rule does not declare `static`.
   */
  static(format: ThymianFormat): Promise<RuleTestExecution[]>;
};

/**
 * How the rule is configured for the run.
 */
export type RunRuleConfiguration<
  Options extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>,
> = {
  /**
   * The rule's options, handed to the rule function as the `options` of the
   * rule's entry in a config are. Call `runRule` once per configuration to
   * test. `runRule` throws when the rule's options schema does not accept
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
 * expect(await runRule(createdResponsesHaveLocation).static(format)).toMatchObject([
 *   { location: { elementId: launchCreated }, status: 'failed' },
 * ]);
 * ```
 */
export function runRule<Options extends Record<PropertyKey, unknown>>(
  rule: Rule<Options>,
  { options }: RunRuleConfiguration<Options> = {},
): RunRule {
  // A rule's options type is fixed by its own schema; the engines take rules
  // of any options type the same way.
  const anyRule = rule as unknown as Rule;
  const underTest = ruleUnderTest(anyRule, options);

  return {
    async static(format) {
      assertDeclares(anyRule, 'static');
      return runStatic(underTest, format);
    },
  };
}

function assertDeclares(rule: Rule, context: 'static'): void {
  if (!rule.meta.type.includes(context)) {
    throw new Error(
      `Rule "${rule.meta.name}" does not declare the "${context}" context. It declares: ${rule.meta.type.join(', ')}.`,
    );
  }
}
