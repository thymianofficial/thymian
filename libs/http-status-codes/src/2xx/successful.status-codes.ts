export const successfulStatusCodes = [
  200, 201, 202, 203, 204, 205, 206, 207, 208,
] as const;

export type SuccessfulStatusCode = (typeof successfulStatusCodes)[number];

export function isValidSuccessfulStatusCode(
  code: number,
): code is SuccessfulStatusCode {
  return successfulStatusCodes.includes(code as SuccessfulStatusCode);
}
