import type { Action } from './action.js';

export interface ReportFlushResponse {
  text?: string;
}

export type ReportFlushAction = Action<void, ReportFlushResponse>;
