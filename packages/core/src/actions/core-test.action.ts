import type { SerializedThymianFormat } from '../format/index.js';
import type { ToolRun } from '../report/index.js';
import type { Action } from './action.js';
import type { CoreValidationInput } from './core-validation-input.js';

export interface CoreTestInput extends CoreValidationInput {
  format: SerializedThymianFormat;
  targetUrl?: string;
}

export type TestAction = Action<CoreTestInput, ToolRun[]>;
