import type { RuleType } from './rule-meta.js';
import type { RuleSeverity } from './rule-severity.js';

export type SingleRuleConfiguration<
  Options extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>,
> = {
  severity?: RuleSeverity;
  type?: RuleType[];
  skipOrigins?: string[];
  options?: Options;
};

export type RulesConfiguration = Record<
  string,
  RuleSeverity | SingleRuleConfiguration
>;
