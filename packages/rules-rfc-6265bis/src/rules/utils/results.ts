// What the rule functions of this package return — a violation, or a
// `rule-skip` for an input a rule cannot decide — and the options they take.

import type { RuleFnResult, RuleViolationLocation } from '@thymian/core';

// No rule in this package takes options.
export type RuleOptions = Record<PropertyKey, unknown>;

export function violation(
  location: RuleViolationLocation,
  message: string,
): RuleFnResult {
  return { location, violation: { message }, findings: [] };
}

// A result that says the rule could not decide this input, rather than pass
// it: a finding with no violation, which the reports render as skipped.
export function ruleSkip(
  location: RuleViolationLocation,
  ruleName: string,
  message: string,
): RuleFnResult {
  return {
    location,
    findings: [{ kind: 'rule-skip', title: ruleName, message }],
  };
}
