import type { ThymianActionName, ThymianActions } from '../actions/index.js';

export type ActionEventPayload<Action extends ThymianActionName> =
  ThymianActions[Action]['event'];

export type ResponseEventPayload<Action extends ThymianActionName> =
  ThymianActions[Action]['response'];

export type ThymianActionEvent<Action extends ThymianActionName> = {
  name: Action;
  id: string;
  payload: ActionEventPayload<Action>;
  timestamp: number;
  source: string;
};

export type ThymianResponseEvent<Action extends ThymianActionName> = {
  id: string;
  name: Action;
  correlationId: string;
  payload: ResponseEventPayload<Action>;
  timestamp: number;
  source: string;
};
