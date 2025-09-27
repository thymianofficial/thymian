export const successfulPhrases = [
  'ok',
  'created',
  'accepted',
  'non-authoritative information',
  'no content',
  'reset content',
  'partial content',
  'multi-status',
  'already reported',
] as const;

export type SuccessfulPhrase = (typeof successfulPhrases)[number];

export function isValidSuccessfulPhrase(
  phrase: string,
): phrase is SuccessfulPhrase {
  return successfulPhrases.includes(phrase as SuccessfulPhrase);
}
