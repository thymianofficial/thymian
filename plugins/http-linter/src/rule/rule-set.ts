import type { Rule } from './rule.js';

export type RuleSet = {
  name: string;
  options?: Record<string, unknown>;
  rules?: Rule[];
  patterns?: string[];
};
