import type { RuleSeverity } from './rule-severity.js';

export type RuleViolationLocation =
  | {
      elementType: 'node' | 'edge';
      elementId: string;
      pointer?: string;
      label?: string;
    }
  | string;

export type RuleViolation = {
  location: RuleViolationLocation;
  message?: string;
};

/**
 * A rule violation enriched with the rule name and resolved severity
 * from the rule runner. This is the type returned by `runRules()`.
 */
export type EvaluatedRuleViolation = {
  ruleName: string;
  severity: Exclude<RuleSeverity, 'off'>;
  violation: Required<RuleViolation>;
};

export type RuleFnResult = undefined | RuleViolation | RuleViolation[];
