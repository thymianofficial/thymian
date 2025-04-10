export const informationalPhrases = [
  'continue',
  'switching protocols',
  'processing',
  'early hints',
] as const;

export type InformationalPhrase = (typeof informationalPhrases)[number];

export function isValidInformationalPhrase(
  phrase: string
): phrase is InformationalPhrase {
  return informationalPhrases.includes(phrase as InformationalPhrase);
}
