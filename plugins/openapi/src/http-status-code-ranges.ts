import {
  clientErrorStatusCodes,
  informationalStatusCodes,
  redirectionStatusCodes,
  serverErrorStatusCodes,
  successfulStatusCodes,
} from '@thymian/http-status-codes';

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
