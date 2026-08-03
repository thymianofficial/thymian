import { settings } from '@oclif/core';
import { compareSeverityGroupKeys } from '@thymian/core';
import wrapAnsi from 'wrap-ansi';

const SINGLE_INDENTATION = '  ';

export function indent(times: number): string {
  return SINGLE_INDENTATION.repeat(times);
}

/**
 * Mirror of `@oclif/core`'s internal `screen.js` `termwidth`, reachable only
 * via the public API (the private module is not exported). Clamps a real TTY
 * width the same way oclif does: non-TTY → 80, `< 1` → 80, `< 40` → 40.
 */
function termwidth(stream: NodeJS.WriteStream): number {
  if (!stream.isTTY) {
    return 80;
  }

  const width = stream.getWindowSize?.()[0] ?? 80;

  if (width < 1) {
    return 80;
  }

  if (width < 40) {
    return 40;
  }

  return width;
}

/**
 * The terminal width oclif itself wraps help/errors at: `OCLIF_COLUMNS` env,
 * then `settings.columns` (`globalThis.oclif`), else the clamped real
 * `process.stdout` width. Computed per-call so `OCLIF_COLUMNS` and stdout
 * changes are honoured (e.g. in tests).
 */
export function terminalWidth(): number {
  const columns =
    Number.parseInt(process.env.OCLIF_COLUMNS ?? '', 10) || settings.columns;

  return columns || termwidth(process.stdout);
}

/**
 * ANSI-aware hard wrap at the current terminal width, reserving `indentColumns`
 * for indentation already consumed on the line (glyphs + leading spaces).
 * Returns the wrapped text WITHOUT re-applying the indent — callers that need
 * hanging indentation should use {@link wrapIndented}.
 */
export function wrap(text: string, indentColumns = 0): string {
  const width = Math.max(terminalWidth() - indentColumns, 1);

  return wrapAnsi(text, width, { hard: true });
}

/**
 * Wraps leaf prose and re-applies indentation as a HANGING indent: the caller
 * supplies the first line's prefix (indent + optional tree glyph, e.g.
 * `"  ├── "`); continuation lines are prefixed with an equal number of spaces
 * so they align under the content and the glyph is never repeated. Wrapping
 * happens at `terminalWidth() - continuationColumns` (the visible, ANSI-stripped
 * width of `firstPrefix` by default) so the content column is consistent across
 * all lines.
 *
 * @param text the prose to wrap (may contain ANSI codes)
 * @param firstPrefix the exact prefix for the first line (indent + glyph)
 * @param continuationColumns spaces to indent continuation lines to; defaults
 *   to the visible width of `firstPrefix`
 */
export function wrapIndented(
  text: string,
  firstPrefix: string,
  continuationColumns = visibleWidth(firstPrefix),
): string[] {
  const wrapped = wrap(text, continuationColumns).split('\n');
  const continuation = ' '.repeat(continuationColumns);

  return wrapped.map((line, index) =>
    index === 0 ? firstPrefix + line : continuation + line,
  );
}

const ESC = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');

/** Visible column width of a string, ignoring ANSI SGR escape codes. */
function visibleWidth(value: string): number {
  return value.replace(ANSI_PATTERN, '').length;
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
