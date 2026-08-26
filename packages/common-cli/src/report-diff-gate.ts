import type { ReportDiffChange } from '@thymian/core';

/**
 * `--fail-on` modes for `thymian report diff` (#502, ADR-0021). The gate
 * classifies DIFF CHANGES, not report executions — ADR-0015's
 * severity-independent report classification is untouched; reading the
 * resolved severity of an *added change* here is a consumer-layer decision
 * (Epic 323: callers decide which findings gate the exit code).
 *
 * - `regression` (default): any added run-result change fails, regardless of
 *   severity. Improvements, specification changes, and rule changes never
 *   fail.
 * - `error`: only added run-result changes with resolved severity `error`
 *   fail.
 * - `any-change`: any change at all fails (a pure change detector).
 * - `none`: never fails (usage/tool errors still exit 2 elsewhere).
 */
export const FAIL_ON_VALUES = [
  'regression',
  'error',
  'any-change',
  'none',
] as const;

export type FailOnMode = (typeof FAIL_ON_VALUES)[number];

/** True when the diff should fail the gate (CLI exit 1) under `mode`. */
export function reportDiffGateFails(
  changes: ReportDiffChange[],
  mode: FailOnMode,
): boolean {
  switch (mode) {
    case 'none':
      return false;
    case 'any-change':
      return changes.length > 0;
    case 'error':
      return changes.some(
        (change) =>
          change.kind === 'run-result' &&
          change.change === 'added' &&
          change.severity === 'error',
      );
    case 'regression':
      return changes.some(
        (change) => change.kind === 'run-result' && change.change === 'added',
      );
  }
}
