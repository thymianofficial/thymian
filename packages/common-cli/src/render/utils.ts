import { compareSeverityGroupKeys } from '@thymian/core';

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

/**
 * Orders record keys for `--sort-reports-by=severity` grouping via the shared
 * core comparator (`error` → `warn` → `hint` → `info`, non-severities last).
 */
export function sortRecordBySeverity<T>(
  record: Record<string, T>,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([keyA], [keyB]) =>
      compareSeverityGroupKeys(keyA, keyB),
    ),
  );
}
