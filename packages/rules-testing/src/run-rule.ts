import type { Rule, ThymianFormat } from '@thymian/core';

import type { RuleTestExecution } from './rule-test-execution.js';
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
 * Tests a rule through the real engine of a validation context it declares.
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
): RunRule {
  // A rule's options type is fixed by its own schema; the engines take rules
  // of any options type the same way.
  const anyRule = rule as unknown as Rule;

  return {
    async static(format) {
      assertDeclares(anyRule, 'static');
      return runStatic(anyRule, format);
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
