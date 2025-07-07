import type { SerializedThymianFormat } from '../format/index.js';
import type { CloseActionResult } from '../actions/close.action.js';

export interface ThymianActions {
  'core.ready': {
    event: void;
    response: void;
  };
  'core.close': {
    event: void;
    response: CloseActionResult;
  };
  'core.load-format': {
    event: void;
    response: SerializedThymianFormat;
  };
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
};

export type ThymianResponseEvent<Event extends ThymianActionName> = {
  name: Event;
  correlationId: string;
  payload: ResponseEventPayload<Event>;
  timestamp: number;
};
