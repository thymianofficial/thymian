import type { Rule } from './rule/rule.js';
import type { RuleType } from './rule/rule-meta.js';
import {
  type RuleSeverity,
  severityLevelValues,
} from './rule/rule-severity.js';

export type RuleFilter = (rule: Rule) => boolean;

export function createRuleFilter({
  severity,
  type,
}: {
  severity: RuleSeverity;
  type: RuleType[];
}): RuleFilter {
  // we need this so we don't load any rules of the severity of the linter is set to off
  if (severity === 'off') {
    return () => false;
  }

  const ruleFilters: RuleFilter[] = [];

  ruleFilters.push(
    (rule) =>
      severityLevelValues[rule.meta.severity] <= severityLevelValues[severity],
  );

  ruleFilters.push((rule) => type.some((t) => rule.meta.type.includes(t)));

  return (rule) => ruleFilters.every((filter) => filter(rule));
}
