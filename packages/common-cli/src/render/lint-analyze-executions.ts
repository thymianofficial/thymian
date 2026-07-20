import { type AnalyzeExecution, type LintExecution } from '@thymian/core';

import type { RenderExecutionDetailsFn } from './create-execution-renderer.js';
import { renderFindings } from './findings.js';

export const renderLintAndAnalyzeExecution: RenderExecutionDetailsFn<
  LintExecution | AnalyzeExecution
> = (execution, indentationLevel) =>
  renderFindings(execution.findings, indentationLevel + 1);
