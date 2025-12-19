import type { SerializedThymianFormat } from '../format/index.js';
import type { Action } from './action.js';

export type FormatAction = Action<SerializedThymianFormat, void>;
