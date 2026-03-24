import type { Rule } from './rule.js';

export type RuleSet = {
  name: string;
  url?: string;
  options?: Record<string, unknown>;
  rules?: Rule[];
  pattern?: string | string[];
};
