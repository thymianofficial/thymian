import type { SuccessfulPhrase } from './successful.phrases.js';
import type { SuccessfulStatusCode } from './successful.status-codes.js';

export const successfulStatusCodeToPhrase = {
  200: 'ok',
  201: 'created',
  202: 'accepted',
  203: 'non-authoritative information',
  204: 'no content',
  205: 'reset content',
  206: 'partial content',
  207: 'multi-status',
  208: 'already reported',
} satisfies Record<SuccessfulStatusCode, SuccessfulPhrase>;

export const successfulPhraseToStatusCode = {
  [successfulStatusCodeToPhrase['200']]: 200,
  [successfulStatusCodeToPhrase['201']]: 201,
  [successfulStatusCodeToPhrase['202']]: 202,
  [successfulStatusCodeToPhrase['203']]: 203,
  [successfulStatusCodeToPhrase['204']]: 204,
  [successfulStatusCodeToPhrase['205']]: 205,
  [successfulStatusCodeToPhrase['206']]: 206,
  [successfulStatusCodeToPhrase['207']]: 207,
  [successfulStatusCodeToPhrase['208']]: 208,
} satisfies Record<SuccessfulPhrase, SuccessfulStatusCode>;

export * from './successful.phrases.js';
export * from './successful.status-codes.js';
