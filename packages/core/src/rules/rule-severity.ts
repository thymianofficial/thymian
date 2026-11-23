export type RuleSeverity = (typeof severityLevels)[number];

export const severityLevelValues = {
  error: 1,
  warn: 2,
  hint: 3,
  off: 4,
} as const;

export const severityLevels = ['off', 'error', 'warn', 'hint'] as const;

/**
 * Compare two rule severities in the order `off` < `hint` < `warn` < `error`,
 * where *above* means more severe. Returns a negative number, zero or a
 * positive number when `a` is below, equal to or above `b`, so it can be
 * passed straight to `Array.prototype.sort`.
 */
export function compareRuleSeverities(
  a: RuleSeverity,
  b: RuleSeverity,
): number {
  // `severityLevelValues` counts down, so the subtraction is reversed.
  return severityLevelValues[b] - severityLevelValues[a];
}

export function isRuleSeverityLevel(level: unknown): level is RuleSeverity {
  return (
    typeof level === 'string' &&
    (severityLevels as readonly string[]).includes(level)
  );
}
