import type { RuleType } from './rule-meta.js';
import type { RuleSeverity } from './rule-severity.js';

export type SingleRuleConfiguration<
  Options extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>,
> = {
  severity?: RuleSeverity;
  // A type override replaces the rule's declared types outright, so an empty
  // array would leave the rule with none. Matching the builder's
  // `.type(...types)` constraint keeps that unrepresentable for a profile
  // authored in TypeScript; the config schema's `minItems` covers the same
  // case for a config file.
  type?: [RuleType, ...RuleType[]];
  skipOrigins?: string[];
  options?: Options;
};

export type RulesConfiguration = Record<
  string,
  RuleSeverity | SingleRuleConfiguration
>;
