import type { CloseAction } from './close.action.js';
import type { AnalyzeAction } from './core-analyze.action.js';
import type { LintAction } from './core-lint.action.js';
import type { RequestSampleAction } from './core-request-sample.action.js';
import type { TestAction } from './core-test.action.js';
import type { CoreValidateSpecsAction } from './core-validate-specs.action.js';
import type { FormatAction } from './format.action.js';
import type { FormatLoadAction } from './format-load.action.js';
import type { ReadyAction } from './ready.action.js';
import type { ReportFlushAction } from './report-flush.action.js';
import type { RequestDispatchAction } from './request-dispatch.action.js';
import type { TrafficLoadAction } from './traffic-load.action.js';

export interface ThymianActions {
  'core.ready': ReadyAction;
  'core.close': CloseAction;
  'core.format.load': FormatLoadAction;
  'core.traffic.load': TrafficLoadAction;
  'core.lint': LintAction;
  'core.test': TestAction;
  'core.analyze': AnalyzeAction;
  'core.validate-specs': CoreValidateSpecsAction;
  'core.report.flush': ReportFlushAction;
  'core.request.dispatch': RequestDispatchAction;
  'core.request.sample': RequestSampleAction;
  'core.format': FormatAction;
}

export type ThymianActionName = keyof ThymianActions;

export * from './close.action.js';
export * from './core-analyze.action.js';
export * from './core-lint.action.js';
export * from './core-request-sample.action.js';
export * from './core-test.action.js';
export * from './core-validate-specs.action.js';
export * from './core-validation-input.js';
export * from './format.action.js';
export * from './format-load.action.js';
export * from './ready.action.js';
export * from './report-flush.action.js';
export * from './request-dispatch.action.js';
export * from './spec-validation-result.js';
export * from './traffic-load.action.js';
export * from './validation-result.js';
