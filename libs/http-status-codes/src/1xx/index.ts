import type { InformationalPhrase } from './informational.phrases.js';
import type { InformationalStatusCode } from './informational.status-codes.js';

export const informationalStatusCodeToPhrase = {
  100: 'continue',
  101: 'switching protocols',
  102: 'processing',
  103: 'early hints',
} satisfies Record<InformationalStatusCode, InformationalPhrase>;

export const informationalPhraseToStatusCode = {
  [informationalStatusCodeToPhrase[100]]: 100,
  [informationalStatusCodeToPhrase[101]]: 101,
  [informationalStatusCodeToPhrase[102]]: 102,
  'early hints': 103,
} satisfies Record<InformationalPhrase, InformationalStatusCode>;

export * from './informational.phrases.js';
export * from './informational.status-codes.js';
