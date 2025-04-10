import { type InformationalPhrase, informationalPhrases } from './1xx/index.js';
import { type SuccessfulPhrase, successfulPhrases } from './2xx/index.js';
import { type RedirectionPhrase, redirectionPhrases } from './3xx/index.js';
import { type ClientErrorPhrase, clientErrorPhrases } from './4xx/index.js';
import { type ServerErrorPhrase, serverErrorPhrases } from './5xx/index.js';

export type HttpStatusPhrase =
  | InformationalPhrase
  | SuccessfulPhrase
  | RedirectionPhrase
  | ClientErrorPhrase
  | ServerErrorPhrase;

export const httpPhrases = [
  ...informationalPhrases,
  ...successfulPhrases,
  ...redirectionPhrases,
  ...clientErrorPhrases,
  ...serverErrorPhrases,
] as const;
