export const serverErrorPhrases = [
  'internal server error',
  'not implemented',
  'bad gateway',
  'service unavailable',
  'gateway timeout',
  'http version not supported',
  'variant also negotiates',
  'insufficient storage',
  'loop detected',
  'not extended',
  'network authentication required',
] as const;

export type ServerErrorPhrase = (typeof serverErrorPhrases)[number];

export function isValidServerErrorPhrase(
  phrase: string,
): phrase is ServerErrorPhrase {
  return serverErrorPhrases.includes(phrase as ServerErrorPhrase);
}
