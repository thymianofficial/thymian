import type { Severity } from '@thymian/core';

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

/** Progressive-enhancement colored span; GitHub strips `style`, IDEs render it. */
export function colorSpan(hex: string, text: string): string {
  return `<span style="color:${hex}">${text}</span>`;
}
