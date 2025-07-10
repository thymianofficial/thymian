import type { CloseAction } from '../actions/close.action.js';
import type { LoadFormatAction } from '../actions/load-format.action.js';
import type { ReadyAction } from '../actions/ready.action.js';

export interface ThymianActions {
  'core.ready': ReadyAction;
  'core.close': CloseAction;
  'core.load-format': LoadFormatAction;
}

export type ThymianActionName = keyof ThymianActions;

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
