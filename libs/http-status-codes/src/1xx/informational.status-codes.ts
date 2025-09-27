export const informationalStatusCodes = [100, 101, 102, 103] as const;

export type InformationalStatusCode = (typeof informationalStatusCodes)[number];

export function isValidInformationalStatusCode(
  code: number,
): code is InformationalStatusCode {
  return informationalStatusCodes.includes(code as InformationalStatusCode);
}
