import type { Logger } from '../logger/logger.js';
import { resolveExecutionSeverity } from './finding-render.js';
import type { Execution, RuleDescriptor, Severity } from './report.js';
import { SEVERITY_GROUP_ORDER } from './report-style.js';

/** The accepted `--sort-reports-by` values — the single source for the flag,
 * the reporter option schema, and the {@link SortReportsBy} type. */
export const SORT_REPORTS_BY_VALUES = ['rule', 'endpoint', 'severity'] as const;

/**
 * Strategy used to group findings in report output, controlled by the
 * `--sort-reports-by` flag. `endpoint` (the default) reproduces the historical
 * grouping on every surface.
 */
export type SortReportsBy = (typeof SORT_REPORTS_BY_VALUES)[number];

/** Heading label for executions with no rule id under `rule` grouping. */
export const UNNAMED_CHECK_LABEL = 'unnamed check';

/**
 * Group key for an execution under `severity` grouping. Skipped executions have
 * no severity, so they get a dedicated `skipped` bucket rather than being
 * mislabelled as errors.
 */
export function severityGroupKey(
  execution: Execution,
  ruleIndex: ReadonlyMap<string, RuleDescriptor>,
  logger?: Logger,
): string {
  return (
    resolveExecutionSeverity(execution, ruleIndex, logger) ??
    (execution.status.kind === 'skipped' ? 'skipped' : 'error')
  );
}

/**
 * First resolvable execution severity in a group — the `rule`-heading severity
 * fallback when the rule id has no descriptor. Returns `undefined` when no
 * execution resolves one (callers default to `error`).
 */
export function resolveGroupSeverity(
  executions: readonly Execution[],
  ruleIndex: ReadonlyMap<string, RuleDescriptor>,
  logger?: Logger,
): Severity | undefined {
  for (const execution of executions) {
    const severity = resolveExecutionSeverity(execution, ruleIndex, logger);
    if (severity !== undefined) {
      return severity;
    }
  }
  return undefined;
}

/**
 * Orders `severity` group keys by `SEVERITY_GROUP_ORDER` (error→warn→hint→info),
 * with any non-severity key (e.g. the `skipped` bucket) sorted last.
 */
export function compareSeverityGroupKeys(a: string, b: string): number {
  const order: readonly string[] = SEVERITY_GROUP_ORDER;
  const rank = (key: string): number => {
    const index = order.indexOf(key);
    return index === -1 ? order.length : index;
  };
  return rank(a) - rank(b) || a.localeCompare(b);
}

/** Pluralizes a severity word (`error`→`errors`, …) for severity-group headings. */
export function pluralizeSeverity(severity: string): string {
  switch (severity) {
    case 'error':
      return 'errors';
    case 'warn':
      return 'warnings';
    case 'info':
      return 'infos';
    case 'hint':
      return 'hints';
    default:
      return severity;
  }
}
