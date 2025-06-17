import { informationalStatusCodes } from './1xx/index.js';
import { successfulStatusCodes } from './2xx/index.js';
import { redirectionStatusCodes } from './3xx/index.js';
import { clientErrorStatusCodes } from './4xx/index.js';
import { serverErrorStatusCodes } from './5xx/index.js';

export const httpStatusCodeRanges = {
  '1XX': informationalStatusCodes,
  '2XX': successfulStatusCodes,
  '3XX': redirectionStatusCodes,
  '4XX': clientErrorStatusCodes,
  '5XX': serverErrorStatusCodes,
} as const;

export type HttpStatusCodeRange = keyof typeof httpStatusCodeRanges;

export function isHttpStatusCodeRange(
  statusCode: string
): statusCode is HttpStatusCodeRange {
  return /^[12345]XX$/.test(statusCode);
}
