export const logLevels = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'silent',
] as const;

export type LogLevel = (typeof logLevels)[number];

const logLevelValues: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  silent: 5,
};

export function isLogLevel(value: unknown): value is LogLevel {
  return (
    typeof value === 'string' &&
    (logLevels as readonly string[]).includes(value)
  );
}

export function shouldLog(
  messageLevel: LogLevel,
  configuredLevel: LogLevel,
): boolean {
  return logLevelValues[messageLevel] >= logLevelValues[configuredLevel];
}
