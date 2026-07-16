import { type TestCaseExecution } from '@thymian/core';

import type {
  GroupExecutionsFn,
  RenderExecutionDetailsFn,
} from './create-execution-renderer.js';
import { renderFindings } from './findings.js';
import { indent } from './utils.js';

export const groupTestCaseExecutions: GroupExecutionsFn<TestCaseExecution> = (
  execution,
) => execution.name;

export const renderTestCaseExecution: RenderExecutionDetailsFn<
  TestCaseExecution
> = (execution, indentationLevel, locationResolver, toolRun) => {
  if (execution.steps[0] && execution.steps.length < 2) {
    return renderFindings(execution.steps[0].findings, indentationLevel);
  }

  const lines: string[] = [];

  const lastStepIdx = execution.steps.length - 1;
  for (const [idx, step] of execution.steps.entries()) {
    lines.push(indent(indentationLevel) + '│');
    lines.push(
      `${indent(indentationLevel)}${idx === lastStepIdx ? '└──' : '├──'} ${step.name}: ${locationResolver(step.location, toolRun.thymianFormatVersion)}`,
    );
    lines.push(
      ...renderFindings(step.findings, indentationLevel + 3, {
        renderRuleViolationTitle: true,
      }),
    );
  }

  return lines;
};
