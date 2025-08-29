import type { ThymianEventName, ThymianEvents } from 'src/events/index.js';

export type EventPayload<Event extends ThymianEventName> = ThymianEvents[Event];

export type ThymianEvent<Event extends ThymianEventName> = {
  id: string;
  name: Event;
  payload: EventPayload<Event>;
  timestamp: number;
  source: string;
};
