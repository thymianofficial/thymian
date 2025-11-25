import type { ServerErrorPhrase } from './server-error.phrases.js';
import type { ServerErrorStatusCode } from './server-error.status-codes.js';

export const serverErrorStatusCodeToPhrase = {
  500: 'internal server error',
  501: 'not implemented',
  502: 'bad gateway',
  503: 'service unavailable',
  504: 'gateway timeout',
  505: 'http version not supported',
  506: 'variant also negotiates',
  507: 'insufficient storage',
  508: 'loop detected',
  510: 'not extended',
  511: 'network authentication required',
} satisfies Record<ServerErrorStatusCode, ServerErrorPhrase>;

export const serverErrorPhraseToStatusCode = {
  [serverErrorStatusCodeToPhrase[500]]: 500,
  [serverErrorStatusCodeToPhrase[501]]: 501,
  [serverErrorStatusCodeToPhrase[502]]: 502,
  [serverErrorStatusCodeToPhrase[503]]: 503,
  [serverErrorStatusCodeToPhrase[504]]: 504,
  [serverErrorStatusCodeToPhrase[505]]: 505,
  [serverErrorStatusCodeToPhrase[506]]: 506,
  [serverErrorStatusCodeToPhrase[507]]: 507,
  [serverErrorStatusCodeToPhrase[508]]: 508,
  [serverErrorStatusCodeToPhrase[510]]: 510,
  [serverErrorStatusCodeToPhrase[511]]: 511,
} satisfies Record<ServerErrorPhrase, ServerErrorStatusCode>;

export * from './server-error.phrases.js';
export * from './server-error.status-codes.js';
