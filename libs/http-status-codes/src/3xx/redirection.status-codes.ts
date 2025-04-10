export const redirectionStatusCodes = [
  300, 301, 302, 303, 304, 307, 308,
] as const;

export type RedirectionStatusCode = (typeof redirectionStatusCodes)[number];

export function isValidRedirectionStatusCode(
  code: number
): code is RedirectionStatusCode {
  return redirectionStatusCodes.includes(code as RedirectionStatusCode);
}
