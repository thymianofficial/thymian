import type { RuleSeverity } from './rule-severity.js';

export type RuleViolationLocation =
  | {
      elementType: 'node' | 'edge';
      elementId: string;
      pointer?: string;
      label?: string;
    }
  | string;

/**
 * A group of transactions as a location: the group a grouped rule
 * (`validateGroupedCommonHttpTransactions`) was handed, with the locations of
 * its members.
 *
 * The validation contexts make it; a rule does not. A grouped rule that finds
 * the group as a whole at fault returns the group key as its location, and the
 * context it ran in names the members.
 */
export type RuleViolationGroupLocation = {
  elementType: 'group';
  /** The group key the rule was handed and returned as its location. */
  key: string;
  /**
   * Where each member of the group is, as the rule was handed it, each
   * location once.
   */
  members: RuleViolationLocation[];
};

/**
 * Tells a group location from the locations a rule names itself.
 */
export function isRuleViolationGroupLocation(
  location: RuleViolationLocation | RuleViolationGroupLocation,
): location is RuleViolationGroupLocation {
  return typeof location !== 'string' && location.elementType === 'group';
}

/**
 * Reads the results a grouped rule returned for one group: a result located
 * on the group key is located on the group, with its members named. Every
 * other result keeps the location the rule gave it.
 */
export function locateOnGroup(
  results: RuleFnResult[],
  key: string,
  members: RuleViolationLocation[],
): RuleFnResult[] {
  const group: RuleViolationGroupLocation = {
    elementType: 'group',
    // The analyzer hands a group key as the store gives it, which need not
    // be a string.
    key: String(key),
    members: members.filter(
      (member, index) =>
        members.findIndex((other) => isSameMember(other, member)) === index,
    ),
  };

  return results.map((result) =>
    result.location === key ? { ...result, location: group } : result,
  );
}

function isSameMember(
  a: RuleViolationLocation,
  b: RuleViolationLocation,
): boolean {
  if (typeof a === 'string' || typeof b === 'string') {
    return a === b;
  }

  return a.elementType === b.elementType && a.elementId === b.elementId;
}

/**
 * The rule-author input union (distinct from the report `FindingRecord` output
 * union). Findings carry *meta* information only — a rule violation is already
 * represented by a `RuleFnResult` with its `violation` property set, so there is
 * no `rule-violation` finding kind here. `rule-skip` is a producer signal the
 * report builder maps to `status: skipped`; it is intentionally NOT a report
 * finding kind either (see `ruleFindingToFindingRecord`).
 *
 * Findings carry no `severity`: a violation's severity is resolved from its
 * execution's `ruleId`/`status`.
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
  ruleId?: string;
  expected?: unknown;
  actual?: unknown;
  reason?: string;
  durationMilliseconds?: number;
  metadata?: Record<string, unknown>;
  /**
   * Zero-based index into the owning test step's transactions of the transaction
   * this finding is about, when tied to a specific transaction. Carried through
   * to {@link BaseFinding.transactionIndex} in the report.
   */
  transactionIndex?: number;
}

/**
 * A rule violation enriched with the rule name and resolved severity
 * from the rule runner. This is the type returned by `runRules()`.
 */
export type EvaluatedRuleViolation = {
  ruleName: string;
  severity: Exclude<RuleSeverity, 'off'>;
  location: RuleViolationLocation | RuleViolationGroupLocation;
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
 * pass still needs a location for grouping). A rule names a
 * {@link RuleViolationLocation}; a {@link RuleViolationGroupLocation} is what a
 * validation context makes of the group key a grouped rule returned. `violation` being present signals
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
  location: RuleViolationLocation | RuleViolationGroupLocation;
  violation?: RuleViolation;
  findings: RuleFinding[];
};
