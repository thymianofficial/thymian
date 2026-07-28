import { ux } from '@oclif/core';
import {
  type AnalyzeExecution,
  buildRuleIndex,
  createLocationResolver,
  type LintExecution,
  type Report,
  resolveExecutionSeverity,
  type Severity,
  SEVERITY_COLORS,
  type SortReportsBy,
  type TestCaseExecution,
  type ThymianFormat,
  walkExecutions,
} from '@thymian/core';

import {
  createExecutionsRenderer,
  selectEntry,
  selectGroupBy,
  selectHeading,
} from './create-execution-renderer.js';
import { renderLintAndAnalyzeExecution } from './lint-analyze-executions.js';
import {
  groupTestCaseExecutions,
  renderTestCaseExecution,
} from './test-executions.js';
import { pluralize, sortRecordByKey, sortRecordBySeverity } from './utils.js';

export function collectSeverityCounts(
  report: Report,
): Record<Severity, number> {
  const counts: Record<Severity, number> = {
    error: 0,
    warn: 0,
    info: 0,
    hint: 0,
  };

  for (const run of report.runs) {
    const ruleIndex = buildRuleIndex(run.rules);
    for (const execution of walkExecutions(run.executions)) {
      const severity = resolveExecutionSeverity(execution, ruleIndex);
      if (severity !== undefined) {
        counts[severity] += 1;
      }
    }
  }

  return counts;
}

export function renderReport(
  report: Report,
  options: { format?: ThymianFormat; sortReportsBy?: SortReportsBy } = {},
): string {
  const sortReportsBy: SortReportsBy = options.sortReportsBy ?? 'endpoint';
  if (report.runs.length === 0) {
    return 'No tool runs were reported.';
  }

  const lines: string[] = [''];
  const reportForLocationResolution =
    options.format !== undefined
      ? {
          ...report,
          thymianFormat: {
            ...(report.thymianFormat ?? {}),
            [options.format.toHash()]: options.format.export(),
          },
        }
      : report;
  const resolveLocation = createLocationResolver(reportForLocationResolution);

  for (const [idx, run] of report.runs.entries()) {
    lines.push(
      `${run.tool.name} · ${run.runType} · ${'─'.repeat(
        Math.max(1, 70 - run.tool.name.length),
      )}`,
    );
    lines.push('');

    const ruleIndex = buildRuleIndex(run.rules);

    // undefined or length === 0
    if (!run.executions?.length) {
      continue;
    }

    // `endpoint` (default) keeps each surface's historical grouping; `rule` and
    // `severity` regroup uniformly across run types. `severity` orders its groups
    // by `SEVERITY_GROUP_ORDER`; the others fall back to alphabetical.
    const sortGroups =
      sortReportsBy === 'severity' ? sortRecordBySeverity : sortRecordByKey;

    if (run.runType === 'lint' || run.runType === 'analyze') {
      const render = createExecutionsRenderer<LintExecution | AnalyzeExecution>(
        selectGroupBy(sortReportsBy, ruleIndex, (execution) =>
          resolveLocation(execution.location, run.thymianFormatVersion),
        ),
        selectHeading(sortReportsBy),
        selectEntry(
          sortReportsBy,
          renderLintAndAnalyzeExecution,
          (execution, locationResolver, toolRun) =>
            locationResolver(execution.location, toolRun.thymianFormatVersion),
        ),
        1,
        sortGroups,
      );

      // `ToolRun` is a discriminated union on `runType`, so a lint/analyze run's
      // executions are already lint/analyze — no runtime filtering needed.
      const executions: (LintExecution | AnalyzeExecution)[] = run.executions;

      lines.push(...render(executions, ruleIndex, resolveLocation, run));
    } else {
      const render = createExecutionsRenderer<TestCaseExecution>(
        selectGroupBy(sortReportsBy, ruleIndex, groupTestCaseExecutions),
        selectHeading(sortReportsBy),
        selectEntry(
          sortReportsBy,
          renderTestCaseExecution,
          (execution) => execution.name,
        ),
        1,
        sortGroups,
      );

      const executions: TestCaseExecution[] = run.executions;

      lines.push(...render(executions, ruleIndex, resolveLocation, run));
    }

    if (idx < report.runs.length - 1) {
      lines.push('');
      lines.push('');
    }
  }

  const counts = collectSeverityCounts(report);
  lines.push('');
  lines.push('');
  lines.push(
    `Summary: ${counts.error} ${ux.colorize(SEVERITY_COLORS.error, pluralize('error', counts.error))}, ${counts.warn} ${ux.colorize(SEVERITY_COLORS.warn, pluralize('warning', counts.warn))}, ${counts.hint} ${ux.colorize(SEVERITY_COLORS.hint, pluralize('hint', counts.hint))}, ${counts.info} ${ux.colorize(SEVERITY_COLORS.info, pluralize('info', counts.info))}.`,
  );

  return lines.join('\n').trimEnd();
}
