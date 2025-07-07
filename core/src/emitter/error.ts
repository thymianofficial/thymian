import type { ThymianError } from '../thymian.error.js';
import type { ThymianActionName } from './actions.js';
import type { ThymianEventName } from './events.js';

export type ErrorName = ThymianEventName | ThymianActionName | 'thymian.error';

export type ThymianErrorEvent<Name extends ErrorName> = {
  name: Name;
  error: ThymianError;
  timestamp: number;
  correlationId?: string;
  source: string;
};
