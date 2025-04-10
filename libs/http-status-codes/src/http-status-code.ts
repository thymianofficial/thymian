import {
  type InformationalStatusCode,
  informationalStatusCodes,
} from './1xx/index.js';
import {
  type SuccessfulStatusCode,
  successfulStatusCodes,
} from './2xx/index.js';
import {
  type RedirectionStatusCode,
  redirectionStatusCodes,
} from './3xx/index.js';
import {
  type ClientErrorStatusCode,
  clientErrorStatusCodes,
} from './4xx/index.js';
import {
  type ServerErrorStatusCode,
  serverErrorStatusCodes,
} from './5xx/index.js';

export type HttpStatusCode =
  | InformationalStatusCode
  | SuccessfulStatusCode
  | RedirectionStatusCode
  | ClientErrorStatusCode
  | ServerErrorStatusCode;

export const httpStatusCodes = [
  ...informationalStatusCodes,
  ...successfulStatusCodes,
  ...redirectionStatusCodes,
  ...clientErrorStatusCodes,
  ...serverErrorStatusCodes,
] as const;
