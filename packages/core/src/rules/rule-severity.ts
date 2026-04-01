export type RuleSeverity = (typeof severityLevels)[number];

export const severityLevelValues = {
  error: 1,
  warn: 2,
  hint: 3,
  off: 4,
} as const;

export const severityLevels = ['off', 'error', 'warn', 'hint'] as const;

export function isRuleSeverityLevel(level: unknown): level is RuleSeverity {
  return (
    typeof level === 'string' &&
    (severityLevels as readonly string[]).includes(level)
  );
}
