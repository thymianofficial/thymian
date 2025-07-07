import type { RegisterPluginEvent } from '../events/register-plugin.event.js';
import type { ReportEvent } from '../events/report.event.js';
import type { ThymianError } from '../thymian.error.js';

export interface ThymianEvents {
  'core.error': ThymianError;
  'core.register': RegisterPluginEvent;
  'core.report': ReportEvent;
}

export type ThymianEventName = keyof ThymianEvents;

export type EventPayload<Event extends ThymianEventName> = ThymianEvents[Event];

export type ThymianEvent<Event extends ThymianEventName> = {
  name: Event;
  payload: EventPayload<Event>;
  timestamp: number;
  source: string;
};
