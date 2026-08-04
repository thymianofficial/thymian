import type { Severity } from './report.js';

export const errorSymbol = '✖';
export const warnSymbol = '⚠';
export const hintSymbol = '✎';
export const infoSymbol = 'ℹ';
export const successSymbol = '✓';
export const skippedSymbol = '⏭';

export const SEVERITY_COLORS: Record<Severity, string> = {
  error: '#d1242f',
  warn: '#9a6700',
  hint: '#0969da',
  info: '#57606a',
};

export const SEVERITY_SYMBOLS: Record<
  Severity | 'skipped' | 'failed' | 'passed',
  string
> = {
  failed: errorSymbol,
  passed: successSymbol,
  skipped: skippedSymbol,
  error: errorSymbol,
  hint: hintSymbol,
  info: infoSymbol,
  warn: warnSymbol,
};

/**
 * Order in which severity groups are rendered under `--sort-reports-by=severity`.
 * Most-to-least severe (`error` → `warn` → `hint` → `info`), matching the CLI
 * Summary line and `SEVERITY_COLORS`/`SEVERITY_SYMBOLS` key order — deliberately
 * NOT alphabetical.
 */
export const SEVERITY_GROUP_ORDER: readonly Severity[] = [
  'error',
  'warn',
  'hint',
  'info',
];
