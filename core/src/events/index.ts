import type { ThymianError } from '../thymian.error.js';
import type { RegisterPluginEvent } from './register-plugin.event.js';
import type { ReportEvent } from './report.event.js';

export interface ThymianEvents {
  'core.error': ThymianError;
  'core.register': RegisterPluginEvent;
  'core.report': ReportEvent;
}

export type ThymianEventName = keyof ThymianEvents;

export * from './error.event.js';
export * from './register-plugin.event.js';
export * from './report.event.js';
