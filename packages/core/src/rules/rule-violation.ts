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
 * Result of a rule execution. The two fields are intermediate types serving
 * distinct purposes and intentionally coexist:
 *
 * - `violations` — location path. Each `RuleViolation` references the
 *   ThymianFormat graph (node/edge id + optional pointer), so violations can
 *   be grouped by endpoint/transaction via `executionsFromViolations()`.
 *   Use this whenever a finding can be pinned to a specific format element.
 * - `findings` — semantic path. `RuleFinding` is the richer type for results
 *   without a format-graph location (test case results, assertions, skips,
 *   informational output). Mapped via `ruleFindingToFindingRecord()`.
 *
 * The report model's `FindingRecord` must only ever be created inside
 * `report-builder.ts` — rule implementations return these types instead.
 */
export interface RuleExecutionResult {
  violations: RuleViolation[];
  findings?: RuleFinding[];
}

export function isRuleExecutionResult(
  value: unknown,
): value is RuleExecutionResult {
  return typeof value === 'object' && value !== null && 'violations' in value;
}

/**
 * A rule violation enriched with the rule name and resolved severity
 * from the rule runner. This is the type returned by `runRules()`.
 */
export type EvaluatedRuleViolation = {
  ruleName: string;
  severity: Exclude<RuleSeverity, 'off'>;
  violation: Required<RuleViolation>;
};

export type RuleFnResult =
  | undefined
  | RuleViolation
  | RuleViolation[]
  | RuleExecutionResult;
