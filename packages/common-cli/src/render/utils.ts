const SINGLE_INDENTATION = '  ';

export function indent(times: number): string {
  return Array.from({ length: times })
    .map(() => SINGLE_INDENTATION)
    .join('');
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
