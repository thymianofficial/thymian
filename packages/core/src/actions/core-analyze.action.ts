import type { SerializedThymianFormat } from '../format/index.js';
import type { ToolRun } from '../report/index.js';
import type { LoadedTraffic } from '../rules/traffic.js';
import type { Action } from './action.js';
import type { CoreValidationInput } from './core-validation-input.js';

export interface CoreAnalyzeInput extends CoreValidationInput {
  traffic: LoadedTraffic;
  format?: SerializedThymianFormat;
}

export type AnalyzeAction = Action<CoreAnalyzeInput, ToolRun[]>;
