import type {
  ReportDiff,
  ReportDiffChange,
  RuleChange,
  RunResultChange,
  SpecificationChange,
} from '@thymian/core';

import type { FailOnMode } from '../report-diff-gate.js';
import { reportDiffGateFails } from '../report-diff-gate.js';

/**
 * Compact, deterministic terminal summary of a report diff (#502 AC 8):
 * counts per change kind, one line per change, and a verdict that visibly
 * separates regressions (new run results) from improvements (resolved ones).
 * Plain text, no colors — e2e asserts deterministic non-TTY output.
 */

function count<T extends ReportDiffChange>(
  changes: T[],
  polarity: ReportDiffChange['change'],
): number {
  return changes.filter((change) => change.change === polarity).length;
}

function runResultLine(change: RunResultChange): string {
  const marker = change.change === 'added' ? '+' : '-';
  const subject =
    change.testCase !== undefined
      ? `"${change.testCase}"`
      : (change.locationLabel ?? '');
  const suffix = change.change === 'added' ? 'new' : 'resolved';

  return [
    marker,
    `[${change.severity}]`,
    change.runType,
    change.ruleId ?? '(no rule)',
    ...(subject ? ['—', subject] : []),
    `(${suffix})`,
  ].join(' ');
}

function specificationLine(change: SpecificationChange): string {
  const marker =
    change.change === 'added' ? '+' : change.change === 'removed' ? '-' : '~';
  const detail =
    change.change === 'changed'
      ? `changed: ${(change.changedAspects ?? []).join(', ')}`
      : change.change;

  return `${marker} endpoint ${change.endpoint} ${detail}`;
}

function ruleLine(change: RuleChange): string {
  const marker = change.change === 'added' ? '+' : '-';

  return `${marker} ${change.scope} ${change.id}${
    change.name ? ` (${change.name})` : ''
  } ${change.change}`;
}

export function renderReportDiffSummary(
  diff: ReportDiff,
  options: { failOn: FailOnMode },
): string {
  const specification = diff.changes.filter(
    (change): change is SpecificationChange => change.kind === 'specification',
  );
  const rules = diff.changes.filter(
    (change): change is RuleChange => change.kind === 'rule',
  );
  const runResults = diff.changes.filter(
    (change): change is RunResultChange => change.kind === 'run-result',
  );

  const lines: string[] = [
    `Report diff: base ${diff.baseReportId} (${diff.baseCreatedAt}) → head ${diff.headReportId} (${diff.headCreatedAt})`,
    '',
    `Specification  ${count(specification, 'added')} added · ${count(specification, 'changed')} changed · ${count(specification, 'removed')} removed`,
    `Rules          ${count(rules, 'added')} added · ${count(rules, 'removed')} removed`,
    `Run results    ${count(runResults, 'added')} new · ${count(runResults, 'removed')} resolved`,
  ];

  if (diff.changes.length > 0) {
    lines.push('');

    for (const change of diff.changes) {
      lines.push(
        change.kind === 'specification'
          ? specificationLine(change)
          : change.kind === 'rule'
            ? ruleLine(change)
            : runResultLine(change),
      );
    }
  }

  lines.push('');

  const newCount = count(runResults, 'added');
  const resolvedCount = count(runResults, 'removed');
  const fails = reportDiffGateFails(diff.changes, options.failOn);

  if (diff.changes.length === 0) {
    lines.push('No changes between base and head.');
  } else if (newCount > 0) {
    lines.push(
      `${fails ? '✖' : '•'} ${newCount} new run result(s) — regression${
        resolvedCount > 0 ? `, ${resolvedCount} resolved` : ''
      }${fails ? ` (fails --fail-on ${options.failOn})` : ''}`,
    );
  } else if (resolvedCount > 0) {
    lines.push(
      `✔ Improvement: ${resolvedCount} run result(s) resolved, none added.`,
    );
  } else {
    lines.push(
      `${fails ? '✖' : '•'} No run-result changes; specification/rule changes only${
        fails ? ` (fails --fail-on ${options.failOn})` : ''
      }.`,
    );
  }

  return lines.join('\n');
}
