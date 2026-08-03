import { settings } from '@oclif/core';
import { compareSeverityGroupKeys } from '@thymian/core';
import stringWidth from 'string-width';
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
 * A positive integer parsed from `value`, or `undefined` if it is not one.
 * Strings are parsed strictly via `Number(...)` (not `parseInt`), so a
 * partially-numeric override like `"80cols"` is rejected rather than silently
 * pinning the width to 80.
 */
function positiveInt(value: string | number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = typeof value === 'string' ? Number(value) : value;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * The terminal width oclif itself wraps help/errors at: an explicit
 * `OCLIF_COLUMNS` env, then `settings.columns` (`globalThis.oclif`), else the
 * clamped real `process.stdout` width. Computed per-call so `OCLIF_COLUMNS` and
 * stdout changes are honoured (e.g. in tests). Only *positive* overrides are
 * accepted, so a bogus `OCLIF_COLUMNS` (e.g. `-1` or a non-number) falls
 * through instead of collapsing every line to a single column.
 *
 * Returns `Infinity` when stdout is not a TTY and no width was pinned: piped or
 * redirected output must be emitted verbatim so paths, JSON and other tokens
 * survive `grep`/copy-paste rather than being reflowed at an arbitrary width.
 */
export function terminalWidth(): number {
  const override =
    positiveInt(process.env.OCLIF_COLUMNS) ?? positiveInt(settings.columns);

  if (override !== undefined) {
    return override;
  }

  return process.stdout.isTTY
    ? termwidth(process.stdout)
    : Number.POSITIVE_INFINITY;
}

/**
 * ANSI-aware soft wrap at the current terminal width, reserving `indentColumns`
 * for indentation already consumed on the line (glyphs + leading spaces).
 * Returns the wrapped text WITHOUT re-applying the indent — callers that need
 * hanging indentation should use {@link wrapIndented}.
 *
 * When there is no finite target width (non-TTY, no pinned columns) the text is
 * returned verbatim. Wrapping is soft (`hard: false`) so unbreakable tokens —
 * file paths, URLs, JSON blobs, rule identifiers — are never split mid-token
 * and stay copy-paste/`grep`-able; only whitespace-separated prose reflows.
 */
export function wrap(text: string, indentColumns = 0): string {
  const available = terminalWidth();

  if (!Number.isFinite(available)) {
    return text;
  }

  const width = Math.max(available - indentColumns, 1);

  return wrapAnsi(text, width, { hard: false });
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
  // Empty content would otherwise emit a lone prefix/glyph line (e.g. a bare
  // tree branch with nothing after it); render nothing instead.
  if (text === '') {
    return [];
  }

  const wrapped = wrap(text, continuationColumns).split('\n');
  const continuation = ' '.repeat(continuationColumns);

  return wrapped.map((line, index) =>
    index === 0 ? firstPrefix + line : continuation + line,
  );
}

/**
 * Visible terminal-column width of a string. Uses `string-width` — the same
 * measurement `wrap-ansi` applies to content — so hanging-indent columns stay
 * consistent with where the wrapped text actually breaks, including for wide
 * (CJK/emoji) glyphs and surrogate pairs where a raw `.length` would diverge.
 * ANSI SGR escape codes are ignored (stripped internally by `string-width`).
 */
function visibleWidth(value: string): number {
  return stringWidth(value);
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
