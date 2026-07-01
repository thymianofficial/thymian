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

/**
 * The rule-author input union (distinct from the report `FindingRecord` output
 * union). Findings carry *meta* information only — a rule violation is already
 * represented by a `RuleFnResult` with its `violation` property set, so there is
 * no `rule-violation` finding kind here. `rule-skip` is a producer signal the
 * report builder maps to `status: skipped`; it is intentionally NOT a report
 * finding kind either (see `ruleFindingToFindingRecord`).
 */
export interface RuleFinding {
  kind:
    | 'rule-skip'
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
 * A rule violation. The optional `message` describes the violation; when
 * absent (or empty) the rule runner falls back to the rule's meta
 * summary/description.
 */
export type RuleViolation = { message?: string };

/**
 * The result of a single rule validation call.
 *
 * `location` is always present (a finding/violation must be locatable, and a
 * pass still needs a location for grouping). `violation` being present signals
 * a violation; its absence signals a pass. `findings` may be populated on both
 * pass and violation (it may also be empty).
 *
 * Valid combinations:
 * - `violation` set, `findings` empty   → pure violation
 * - `violation` set, `findings` filled  → violation with findings
 * - `violation` absent, `findings` filled → pass with findings
 * - `violation` absent, `findings` empty  → pure pass (`{ location, findings: [] }`)
 */
export type RuleFnResult = {
  location: RuleViolationLocation;
  violation?: RuleViolation;
  findings: RuleFinding[];
};
