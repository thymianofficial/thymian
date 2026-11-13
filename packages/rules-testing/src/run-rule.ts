import type { Rule, ThymianFormat } from '@thymian/core';

import type { RuleTestExecution } from './rule-test-execution.js';
import { ruleUnderTest } from './rule-under-test.js';
import { runAnalytics } from './run-analytics.js';
import { runStatic } from './run-static.js';
import { type Respond, runTest } from './run-test.js';

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
  /**
   * Runs the rule as `thymian test` does, without a network, and returns the
   * same list in the same order as `static`. Every request the tester builds
   * is answered in-process: as the format declares it, or by `respond`.
   *
   * Throws when the rule does not declare `test`.
   */
  test(
    format: ThymianFormat,
    configuration?: RunTestConfiguration,
  ): Promise<RuleTestExecution[]>;
  /**
   * Runs the rule as `thymian analyze` does, against traffic held in memory,
   * and returns the same list in the same order as `static`. The traffic is
   * every transaction of the format recorded once: the request the format
   * describes, answered as the format declares it.
   *
   * Throws when the rule does not declare `analytics`, and when the request
   * of a transaction cannot be built from the format.
   */
  analytics(format: ThymianFormat): Promise<RuleTestExecution[]>;
};

/**
 * The server a rule is tested against in `test`.
 */
export type RunTestConfiguration = {
  /**
   * Decides what the server answers to a request. It is given the id of the
   * transaction the request is aimed at, the conforming response of that
   * transaction and the request that was sent. Without it the server answers
   * every request with the conforming response.
   *
   * An answer with another status than the transaction declares makes the
   * transaction `skipped`: the tester does not ask the rule about it.
   */
  respond?: Respond;
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
    async test(format, { respond } = {}) {
      assertDeclares(anyRule, 'test');
      return runTest(underTest, format, respond);
    },
    async analytics(format) {
      assertDeclares(anyRule, 'analytics');
      return runAnalytics(underTest, format);
    },
  };
}

function assertDeclares(
  rule: Rule,
  context: 'static' | 'test' | 'analytics',
): void {
  if (!rule.meta.type.includes(context)) {
    throw new Error(
      `Rule "${rule.meta.name}" does not declare the "${context}" context. It declares: ${rule.meta.type.join(', ')}.`,
    );
  }
}
