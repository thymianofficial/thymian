import type { RuleSeverity } from './rule-severity.js';

export type RuleViolationLocation =
  | {
      elementType: 'node' | 'edge';
      elementId: string;
      pointer?: string;
      label?: string;
    }
  | string;

export type RuleFindingSeverity = 'error' | 'warn' | 'info' | 'hint';

export interface RuleFinding {
  kind:
    | 'rule-violation'
    | 'rule-success'
    | 'rule-failure'
    | 'rule-skip'
    | 'test-case-pass'
    | 'test-case-fail'
    | 'test-case-skip'
    | 'informational'
    | 'assertion-failure'
    | 'assertion-success'
    | (string & {});
  title: string;
  message?: string;
  severity?: RuleFindingSeverity;
  ruleId?: string;
  expected?: unknown;
  actual?: unknown;
  reason?: string;
  durationMilliseconds?: number;
  metadata?: Record<string, unknown>;
}

/**
 * A rule violation enriched with the rule name and resolved severity
 * from the rule runner. This is the type returned by `runRules()`.
 */
export type EvaluatedRuleViolation = {
  ruleName: string;
  severity: Exclude<RuleSeverity, 'off'>;
  location: RuleViolationLocation;
  message: string;
};

/**
 * The result of a single rule validation call.
 * `violationMessage` being defined (even empty string) signals a violation.
 * `violationMessage === undefined` signals a pass.
 * An empty `violationMessage` falls back to the rule's meta summary/description.
 */
export type RuleFnResult = {
  location: RuleViolationLocation;
  violationMessage?: string;
  findings: RuleFinding[];
};
