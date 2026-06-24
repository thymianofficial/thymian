import type { Command } from '@oclif/core';
import { ux } from '@oclif/core';
import type { FindingRecord, Report } from '@thymian/core';

import { renderReport } from './cli-report-renderer.js';

export const HIGH_COUNT_THRESHOLD = 20;

export interface ReportClassificationOptions {
  isFinding?: (finding: FindingRecord) => boolean;
  isToolError?: (finding: FindingRecord) => boolean;
}

type CliReportClassification = 'clean-run' | 'findings' | 'tool-error';

export function classificationToExitCode(
  classification: CliReportClassification,
): 0 | 1 | 2 {
  switch (classification) {
    case 'clean-run':
      return 0;
    case 'findings':
      return 1;
    case 'tool-error':
      return 2;
  }
}

function collectFindings(report: Report): FindingRecord[] {
  const visit = (
    executions: (typeof report.runs)[number]['executions'],
  ): FindingRecord[] =>
    (executions ?? []).flatMap((execution) => [
      ...execution.findings,
      ...visit(execution.children),
    ]);

  return report.runs.flatMap((run) => visit(run.executions));
}

export function classifyReport(
  report: Report,
  options: ReportClassificationOptions = {},
): CliReportClassification {
  const findings = collectFindings(report);
  const isToolError =
    options.isToolError ??
    ((finding: FindingRecord) => finding.kind === 'rule-failure');
  const isFinding =
    options.isFinding ??
    ((finding: FindingRecord) =>
      finding.severity === 'error' || finding.severity === 'warn');

  if (findings.some(isToolError)) {
    return 'tool-error';
  }

  if (findings.some(isFinding)) {
    return 'findings';
  }

  return 'clean-run';
}

function emitGuidance(
  command: { guidance(message: string): void },
  report: Report,
  classification: CliReportClassification,
): void {
  if (classification !== 'findings') {
    return;
  }

  const totalViolations = collectFindings(report).filter(
    (finding) => finding.severity === 'error' || finding.severity === 'warn',
  ).length;

  if (totalViolations > HIGH_COUNT_THRESHOLD) {
    command.guidance(
      `\n${String.fromCodePoint(0x2139)} Running Thymian on an existing API often surfaces many findings. This doesn't mean your API is broken — it means there are HTTP conformance improvements available. Start with errors and work through them incrementally.`,
    );
  }
}

export function handleWorkflowOutcome(
  command: Pick<Command, 'exit'> & { guidance(message: string): void },
  report: Report,
  options: ReportClassificationOptions = {},
): void {
  ux.stdout(renderReport(report));

  const classification = classifyReport(report, options);

  emitGuidance(command, report, classification);

  const exitCode = classificationToExitCode(classification);

  if (exitCode !== 0) {
    command.exit(exitCode);
  }
}
