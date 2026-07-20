import type { Logger } from '../logger/logger.js';
import type {
  Execution,
  FindingRecord,
  RuleDescriptor,
  Severity,
} from './report.js';

/** A single label/value detail extracted from a finding for rendering. */
export interface FindingDetail {
  /** Stable label, e.g. `expected`, `actual`. */
  label: string;
  /** Plain-text value. */
  value: string;
}

/** Build an `id -> descriptor` lookup from a run's rules list. */
export function buildRuleIndex(
  rules: RuleDescriptor[] | undefined,
): ReadonlyMap<string, RuleDescriptor> {
  const index = new Map<string, RuleDescriptor>();

  for (const rule of rules ?? []) {
    index.set(rule.id, rule);
  }

  return index;
}

/**
 * Resolve the effective {@link Severity} of an execution.
 *
 * Only `failed` executions have a severity (per SARIF, a "level" applies only to
 * failing results). For a failed execution the severity is `status.severity`
 * (an override) if present, else the rule's configured severity looked up via
 * `ruleId`, else `'error'` as a last-resort fallback (with a warning). Non-failed
 * executions return `undefined`; if one nonetheless carries a `severity`, that is
 * a model violation — it is warned about and ignored.
 */
export function resolveExecutionSeverity(
  execution: Execution,
  ruleIndex: ReadonlyMap<string, RuleDescriptor>,
  logger?: Logger,
): Severity | undefined {
  const { status } = execution;

  if (status.kind !== 'failed') {
    if (
      'severity' in status &&
      (status as { severity?: unknown }).severity !== undefined
    ) {
      logger?.warn(
        `severity on non-'failed' status (kind '${status.kind}'); ignoring it.`,
      );
    }
    return undefined;
  }

  if (status.severity !== undefined) {
    return status.severity;
  }

  const fromRule =
    execution.ruleId !== undefined
      ? ruleIndex.get(execution.ruleId)?.severity
      : undefined;
  if (fromRule !== undefined) {
    return fromRule;
  }

  logger?.warn(
    `Could not resolve severity for failed execution${
      execution.ruleId ? ` (rule '${execution.ruleId}')` : ''
    }; defaulting to 'error'.`,
  );
  return 'error';
}

/**
 * Extract the kind-specific detail lines for a finding as plain label/value
 * pairs. Renderers decide layout (indented lines, table cells, CSV columns) and
 * apply their own coloring.
 *
 * Rule identity and outcome detail (reason, duration, skip reason) no longer
 * live on findings — they are carried by the owning execution's `ruleId` and
 * {@link ExecutionStatus} and are rendered at the execution level.
 */
export function findingDetails(finding: FindingRecord): FindingDetail[] {
  const details: FindingDetail[] = [];

  if (finding.kind === 'assertion-failure') {
    const { expected, actual } = finding as {
      expected?: unknown;
      actual?: unknown;
    };
    if (expected !== undefined) {
      details.push({ label: 'expected', value: JSON.stringify(expected) });
    }
    if (actual !== undefined) {
      details.push({ label: 'actual', value: JSON.stringify(actual) });
    }
  }

  return details;
}
