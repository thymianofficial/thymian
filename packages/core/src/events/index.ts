import type { ThymianError } from '../thymian.error.js';
import type { ExitEvent } from './exit.event.js';
import type { RegisterPluginEvent } from './register-plugin.event.js';
import type { ReportEvent } from './report.event.js';

export interface ThymianEvents {
  'core.error': ThymianError;
  'core.register': RegisterPluginEvent;
  'core.report': ReportEvent;
  'core.exit': ExitEvent;
}

export type ThymianEventName = keyof ThymianEvents;

export * from './error.event.js';
export * from './register-plugin.event.js';
export * from './report.event.js';
