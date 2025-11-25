import { informationalStatusCodeToPhrase } from './1xx/index.js';
import { successfulStatusCodeToPhrase } from './2xx/index.js';
import { redirectionStatusCodeToPhrase } from './3xx/index.js';
import { clientErrorStatusCodeToPhrase } from './4xx/index.js';
import { serverErrorStatusCodeToPhrase } from './5xx/index.js';

export const httpStatusCodeToPhrase = {
  ...informationalStatusCodeToPhrase,
  ...successfulStatusCodeToPhrase,
  ...redirectionStatusCodeToPhrase,
  ...clientErrorStatusCodeToPhrase,
  ...serverErrorStatusCodeToPhrase,
} as const;
