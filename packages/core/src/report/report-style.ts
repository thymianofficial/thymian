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
