const SINGLE_INDENTATION = '  ';

export function indent(times: number): string {
  return SINGLE_INDENTATION.repeat(times);
}

export function pluralize(word: string, length: number): string {
  return length > 1 || length === 0 ? `${word}s` : word;
}

export function sortRecordByKey<T>(
  record: Record<string, T>,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([keyA], [keyB]) => keyA.localeCompare(keyB)),
  );
}
