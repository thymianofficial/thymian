import type { Rule, RulesConfiguration, RuleSeverity } from '@thymian/core';
import { validate } from '@thymian/core/ajv';

/**
 * A rule made ready for an engine, whatever it ships as.
 */
export type RuleUnderTest = {
  /** The rule as the engine runs it: enabled, also when it ships `off`. */
  rule: Rule;
  /** What a config would say about the rule: its options. */
  rulesConfig: RulesConfiguration;
  /** The severity the rule declares, which is the one a rule test reports. */
  declaredSeverity: RuleSeverity;
};

/**
 * Prepares a rule for the engines. They leave a rule with severity `off`
 * out, so such a rule is handed to them enabled, on a copy, as a config that
 * turns it on would; and they read a rule's options from the rules
 * configuration, so the options go there, checked against the rule's options
 * schema first as the options of a config are when it is loaded.
 */
export function ruleUnderTest(
  rule: Rule,
  options: Record<PropertyKey, unknown> | undefined,
): RuleUnderTest {
  const declaredSeverity = rule.meta.severity;

  if (
    options !== undefined &&
    rule.meta.options &&
    !validate(rule.meta.options, options)
  ) {
    throw new Error(
      `Options for rule "${rule.meta.name}" do not match the options schema of the rule.`,
    );
  }

  return {
    rule:
      declaredSeverity === 'off'
        ? { ...rule, meta: { ...rule.meta, severity: 'error' } }
        : rule,
    rulesConfig: options === undefined ? {} : { [rule.meta.name]: { options } },
    declaredSeverity,
  };
}
