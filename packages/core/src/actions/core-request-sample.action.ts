import type { ThymianHttpTransaction } from '../format/index.js';
import type { HttpRequestTemplate } from '../http.js';
import type { Action } from './action.js';

export interface CoreRequestSampleInput {
  transaction: ThymianHttpTransaction;
  options?: Record<string, unknown>;
}

export type RequestSampleAction = Action<
  CoreRequestSampleInput,
  HttpRequestTemplate
>;
