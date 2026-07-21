import type { Command } from '@oclif/core';
import { ux } from '@oclif/core';
import type { Execution, Report } from '@thymian/core';

import { renderReport } from './render/cli-report.js';

export const HIGH_COUNT_THRESHOLD = 20;

/**
 * Predicates that decide the CLI outcome from a report's executions. Outcomes
 * are now carried by each execution's `status` (a `failed` status ≡ a rule
 * violation), so classification is execution-based rather than finding-based.
 */
export interface ReportClassificationOptions {
  isFinding?: (execution: Execution) => boolean;
  isToolError?: (execution: Execution) => boolean;
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

function collectExecutions(report: Report): Execution[] {
  return report.runs.flatMap((run): Execution[] => run.executions ?? []);
}

export function classifyReport(
  report: Report,
  options: ReportClassificationOptions = {},
): CliReportClassification {
  const executions = collectExecutions(report);
  // Technical "couldn't run" now maps to a `failed` status (there is no distinct
  // tool-error signal in the model), so by default nothing is a tool error;
  // callers may still opt in via a custom predicate.
  const isToolError = options.isToolError ?? (() => false);
  const isFinding =
    options.isFinding ??
    ((execution: Execution) => execution.status.kind === 'failed');

  if (executions.some(isToolError)) {
    return 'tool-error';
  }

  if (executions.some(isFinding)) {
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

  const totalViolations = collectExecutions(report).filter(
    (execution) => execution.status.kind === 'failed',
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
