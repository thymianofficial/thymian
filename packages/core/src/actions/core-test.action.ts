import type { SerializedThymianFormat } from '../format/index.js';
import type { Action } from './action.js';
import type { CoreValidationInput } from './core-validation-input.js';
import type { ValidationResult } from './validation-result.js';

export interface CoreTestInput extends CoreValidationInput {
  format: SerializedThymianFormat;
}

export type TestAction = Action<CoreTestInput, ValidationResult>;
