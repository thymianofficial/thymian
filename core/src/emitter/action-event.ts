import type { ThymianActionName, ThymianActions } from '../actions/index.js';

export type ActionEventPayload<Event extends ThymianActionName> =
  ThymianActions[Event]['event'];

export type ResponseEventPayload<Event extends ThymianActionName> =
  ThymianActions[Event]['response'];

export type ThymianActionEvent<Event extends ThymianActionName> = {
  name: Event;
  correlationId: string;
  payload: ActionEventPayload<Event>;
  timestamp: number;
  source: string;
};

export type ThymianResponseEvent<Event extends ThymianActionName> = {
  name: Event;
  correlationId: string;
  payload: ResponseEventPayload<Event>;
  timestamp: number;
  source: string;
};
