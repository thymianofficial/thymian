export const clientErrorStatusCodes = [
  400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414,
  415, 416, 417, 421, 422, 423, 424, 425, 426, 428, 429, 431, 451,
] as const;

export type ClientErrorStatusCode = (typeof clientErrorStatusCodes)[number];

export function isValidClientErrorStatusCode(
  code: number
): code is ClientErrorStatusCode {
  return clientErrorStatusCodes.includes(code as ClientErrorStatusCode);
}
