export {
  errorSymbol,
  hintSymbol,
  infoSymbol,
  SEVERITY_COLORS,
  skippedSymbol,
  successSymbol,
  warnSymbol,
} from '@thymian/core';

/** Progressive-enhancement colored span; GitHub strips `style`, IDEs render it. */
export function colorSpan(hex: string, text: string): string {
  return `<span style="color:${hex}">${text}</span>`;
}
