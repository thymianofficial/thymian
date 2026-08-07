import type { Rule } from './rule.js';
import type { RulesConfiguration } from './rule-configuration.js';

export type RuleSet = {
  name: string;
  url?: string;
  options?: Record<string, unknown>;
  rules?: Rule[];
  pattern?: string | string[];
  profiles?: Record<string, RulesConfiguration>;
};
