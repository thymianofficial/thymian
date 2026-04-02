import type { Command } from '@oclif/core';
import { ux } from '@oclif/core';
import type { WorkflowClassification, WorkflowOutcome } from '@thymian/core';

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

export function handleWorkflowOutcome(
  command: Pick<Command, 'exit'>,
  outcome: WorkflowOutcome,
): void {
  if (outcome.text) {
    ux.stdout(outcome.text);
  }

  const exitCode = classificationToExitCode(outcome.classification);

  if (exitCode !== 0) {
    command.exit(exitCode);
  }
}
