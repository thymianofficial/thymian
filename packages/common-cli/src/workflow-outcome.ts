import type { Command } from '@oclif/core';
import { ux } from '@oclif/core';
import type { WorkflowClassification, WorkflowOutcome } from '@thymian/core';

/**
 * Default threshold for the high-count brownfield guidance message.
 * When total violation count exceeds this value, a contextual message
 * is emitted to help developers understand that many findings are normal
 * for brownfield APIs.
 */
export const HIGH_COUNT_THRESHOLD = 20;

export function classificationToExitCode(
  classification: WorkflowClassification,
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

/**
 * Emit post-report guidance hints to stderr via the command's `guidance()` method.
 *
 * Called internally by {@link handleWorkflowOutcome} before process exit so that
 * guidance is guaranteed to reach the user even when exit code is non-zero.
 */
function emitGuidance(
  command: { guidance(message: string): void },
  outcome: WorkflowOutcome,
): void {
  if (outcome.classification !== 'findings') {
    return;
  }

  const totalViolations = outcome.results.reduce(
    (sum, r) => sum + r.violations.length,
    0,
  );

  if (totalViolations > HIGH_COUNT_THRESHOLD) {
    command.guidance(
      `\n${String.fromCodePoint(0x2139)} Running Thymian on an existing API often surfaces many findings. This doesn't mean your API is broken \u2014 it means there are HTTP conformance improvements available. Start with errors and work through them incrementally.`,
    );
  }
}

/**
 * Handle workflow outcome: print report text, emit guidance, and exit.
 *
 * Guidance is emitted **before** `command.exit()` because oclif's `exit()`
 * throws an `ExitError` that terminates the command — any code after it
 * is unreachable.
 */
export function handleWorkflowOutcome(
  command: Pick<Command, 'exit'> & { guidance(message: string): void },
  outcome: WorkflowOutcome,
): void {
  if (outcome.text) {
    ux.stdout(outcome.text);
  }

  emitGuidance(command, outcome);

  const exitCode = classificationToExitCode(outcome.classification);

  if (exitCode !== 0) {
    command.exit(exitCode);
  }
}
