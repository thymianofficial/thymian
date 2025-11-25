import type { RedirectionPhrase } from './redirection.phrases.js';
import type { RedirectionStatusCode } from './redirection.status-codes.js';

export const redirectionStatusCodeToPhrase = {
  300: 'multiple choices',
  301: 'moved permanently',
  302: 'found',
  303: 'see other',
  304: 'not modified',
  307: 'temporary redirect',
  308: 'permanent redirect',
} satisfies Record<RedirectionStatusCode, RedirectionPhrase>;

export const redirectionPhraseToStatusCode = {
  [redirectionStatusCodeToPhrase[300]]: 300,
  [redirectionStatusCodeToPhrase[301]]: 301,
  [redirectionStatusCodeToPhrase[302]]: 302,
  [redirectionStatusCodeToPhrase[303]]: 303,
  [redirectionStatusCodeToPhrase[304]]: 304,
  [redirectionStatusCodeToPhrase[307]]: 307,
  [redirectionStatusCodeToPhrase[308]]: 308,
} satisfies Record<RedirectionPhrase, RedirectionStatusCode>;

export * from './redirection.phrases.js';
export * from './redirection.status-codes.js';
