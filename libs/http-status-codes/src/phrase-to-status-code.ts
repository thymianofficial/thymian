import { informationalPhraseToStatusCode } from './1xx/index.js';
import { successfulPhraseToStatusCode } from './2xx/index.js';
import { redirectionPhraseToStatusCode } from './3xx/index.js';
import { clientErrorPhraseToStatusCOde } from './4xx/index.js';
import { serverErrorPhraseToStatusCode } from './5xx/index.js';

export const httpStatusPhraseToStatusCode = {
  ...informationalPhraseToStatusCode,
  ...successfulPhraseToStatusCode,
  ...redirectionPhraseToStatusCode,
  ...clientErrorPhraseToStatusCOde,
  ...serverErrorPhraseToStatusCode,
} as const;
