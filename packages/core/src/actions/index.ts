import type { CloseAction } from './close.action.js';
import type { FormatAction } from './format.action.js';
import type { LoadFormatAction } from './load-format.action.js';
import type { ReadyAction } from './ready.action.js';
import type { RunAction } from './run.action.js';

export interface ThymianActions {
  'core.ready': ReadyAction;
  'core.close': CloseAction;
  'core.load-format': LoadFormatAction;
  'core.run': RunAction;
  'core.format': FormatAction;
}

export type ThymianActionName = keyof ThymianActions;

export * from './close.action.js';
export * from './format.action.js';
export * from './load-format.action.js';
export * from './ready.action.js';
export * from './run.action.js';
