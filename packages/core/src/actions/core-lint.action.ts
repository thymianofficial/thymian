import type { SerializedThymianFormat } from '../format/index.js';
import type { Action } from './action.js';
import type { CoreValidationInput } from './core-validation-input.js';
import type { ToolRun } from '../report/index.js';

export interface CoreLintInput extends CoreValidationInput {
  format: SerializedThymianFormat;
}

export type LintAction = Action<CoreLintInput, ToolRun[]>;
