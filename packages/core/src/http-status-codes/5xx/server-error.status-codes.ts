export const serverErrorStatusCodes = [
  500, 501, 502, 503, 504, 505, 506, 507, 508, 510, 511,
] as const;

export type ServerErrorStatusCode = (typeof serverErrorStatusCodes)[number];

export function isValidServerErrorStatusCode(
  code: number,
): code is ServerErrorStatusCode {
  return serverErrorStatusCodes.includes(code as ServerErrorStatusCode);
}
