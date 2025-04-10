export const clientErrorPhrases = [
  'bad request',
  'unauthorized',
  'payment required',
  'forbidden',
  'not found',
  'method not allowed',
  'not acceptable',
  'proxy authentication required',
  'request timeout',
  'conflict',
  'gone',
  'length required',
  'precondition failed',
  'payload too large',
  'uri too long',
  'unsupported media type',
  'range not satisfiable',
  'expectation failed',
  'misdirected request',
  'unprocessable entity',
  'locked',
  'failed dependency',
  'too early',
  'upgrade required',
  'precondition required',
  'too many requests',
  'request header fields too large',
  'unavailable for legal reasons',
] as const;

export type ClientErrorPhrase = (typeof clientErrorPhrases)[number];

export function isValidClientErrorPhrase(
  phrase: string
): phrase is ClientErrorPhrase {
  return clientErrorPhrases.includes(phrase as ClientErrorPhrase);
}
