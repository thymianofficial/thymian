import type { Rule } from './rule.js';
import type { RuleType } from './rule-meta.js';
import { compareRuleSeverities, type RuleSeverity } from './rule-severity.js';

export type RuleFilter = (rule: Rule) => boolean;

export function createRuleFilter({
  severity,
  type,
}: {
  severity: RuleSeverity;
  type: RuleType[];
}): RuleFilter {
  // we need this so we don't load any rules if the linter severity is set to 'off'
  if (severity === 'off') {
    return () => false;
  }

  const ruleFilters: RuleFilter[] = [];

  ruleFilters.push(
    (rule) => compareRuleSeverities(rule.meta.severity, severity) >= 0,
  );

  ruleFilters.push((rule) => type.some((t) => rule.meta.type.includes(t)));

  return (rule) => ruleFilters.every((filter) => filter(rule));
}
