import type { ThymianActionName } from 'src/actions/index.js';

import type { ThymianEventName } from '../events/index.js';
import type { ThymianError } from '../thymian.error.js';

export type ErrorName = ThymianEventName | ThymianActionName | 'thymian.error';

export type ThymianErrorEvent<Name extends ErrorName> = {
  name: Name;
  error: ThymianError;
  timestamp: number;
  correlationId?: string;
  source: string;
};
