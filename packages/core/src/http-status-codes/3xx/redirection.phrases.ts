export const redirectionPhrases = [
  'multiple choices',
  'moved permanently',
  'found',
  'see other',
  'not modified',
  'temporary redirect',
  'permanent redirect',
] as const;

export type RedirectionPhrase = (typeof redirectionPhrases)[number];

export function isValidRedirectionPhrase(
  phrase: string,
): phrase is RedirectionPhrase {
  return redirectionPhrases.includes(phrase as RedirectionPhrase);
}
