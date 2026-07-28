import { type Severity, SEVERITY_GROUP_ORDER } from '@thymian/core';

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
 * Orders record keys by severity rank (`error` → `warn` → `hint` → `info` per
 * `SEVERITY_GROUP_ORDER`). Keys that are not severities (e.g. the `error`
 * fallback aside, an unexpected value) sort last, alphabetically among
 * themselves. Used for `--sort-reports-by=severity` grouping.
 */
export function sortRecordBySeverity<T>(
  record: Record<string, T>,
): Record<string, T> {
  const order: readonly string[] = SEVERITY_GROUP_ORDER;
  const rank = (key: string): number => {
    const index = order.indexOf(key);
    return index === -1 ? order.length : index;
  };

  return Object.fromEntries(
    Object.entries(record).sort(
      ([keyA], [keyB]) => rank(keyA) - rank(keyB) || keyA.localeCompare(keyB),
    ),
  );
}

export function pluralizeSeverity(severity: string): string {
  switch (severity) {
    case 'error':
      return 'errors';
    case 'warn':
      return 'warnings';
    case 'info':
      return 'infos';
    case 'hint':
      return 'hints';
    default:
      return severity;
  }
}
