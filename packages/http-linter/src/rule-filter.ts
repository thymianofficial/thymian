import { type HttpLinterPluginOptions, severityLevelValues } from './index.js';
import type { Rule } from './rule/rule.js';

export type RuleFilter = (rule: Rule) => boolean;

export function createRuleFilter(
  filters: HttpLinterPluginOptions['ruleFilter'],
): RuleFilter {
  const ruleFilters: RuleFilter[] = [];

  const { severity, appliesTo, names } = filters ?? {};

  if (severity) {
    ruleFilters.push(
      (rule) =>
        severityLevelValues[rule.meta.severity] <=
        severityLevelValues[severity],
    );
  }

  if (appliesTo) {
    ruleFilters.push((rule) =>
      appliesTo.some((role) =>
        rule.meta.appliesTo ? rule.meta.appliesTo.includes(role) : true,
      ),
    );
  }

  if (names) {
    ruleFilters.push((rule) => names.includes(rule.meta.name));
  }

  return (rule) => ruleFilters.every((filter) => filter(rule));
}
