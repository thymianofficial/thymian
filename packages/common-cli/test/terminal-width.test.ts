import { settings } from '@oclif/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { terminalWidth, wrap, wrapIndented } from '../src/render/utils.js';

// ANSI SGR helper so we can assert visible-width wrapping while colour codes
// stay intact.
const ESC = String.fromCharCode(27);
const red = (value: string): string => `${ESC}[31m${value}${ESC}[39m`;
const ANSI_PATTERN = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');
const stripAnsi = (value: string): string => value.replace(ANSI_PATTERN, '');
const visibleWidth = (value: string): number => stripAnsi(value).length;

describe('terminalWidth', () => {
  const originalColumns = process.env.OCLIF_COLUMNS;
  const hadSettingsColumns = 'columns' in settings;
  const originalSettingsColumns = settings.columns;
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    process.stdout,
    'isTTY',
  );
  const originalGetWindowSize = process.stdout.getWindowSize;

  beforeEach(() => {
    delete process.env.OCLIF_COLUMNS;
    delete settings.columns;
  });

  afterEach(() => {
    if (originalColumns === undefined) {
      delete process.env.OCLIF_COLUMNS;
    } else {
      process.env.OCLIF_COLUMNS = originalColumns;
    }

    // Restore `settings.columns` faithfully: delete it when it was originally
    // absent rather than leaving an explicit `undefined` behind.
    if (hadSettingsColumns) {
      settings.columns = originalSettingsColumns;
    } else {
      delete settings.columns;
    }

    if (originalDescriptor) {
      Object.defineProperty(process.stdout, 'isTTY', originalDescriptor);
    }

    // `setTty` may have stubbed `getWindowSize`; restore the real one so it does
    // not leak into later tests.
    process.stdout.getWindowSize = originalGetWindowSize;
  });

  const setTty = (isTTY: boolean, columns?: number): void => {
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: isTTY,
    });
    if (columns !== undefined) {
      process.stdout.getWindowSize = () => [columns, 24];
    }
  };

  it('honours OCLIF_COLUMNS over the real TTY width', () => {
    process.env.OCLIF_COLUMNS = '100';
    setTty(true, 200);

    expect(terminalWidth()).toBe(100);
  });

  it('reports no finite width for non-TTY output (so it is not wrapped)', () => {
    setTty(false);

    expect(terminalWidth()).toBe(Number.POSITIVE_INFINITY);
  });

  it('ignores a non-positive or non-numeric OCLIF_COLUMNS', () => {
    setTty(true, 120);

    process.env.OCLIF_COLUMNS = '-1';
    expect(terminalWidth()).toBe(120);

    process.env.OCLIF_COLUMNS = '0';
    expect(terminalWidth()).toBe(120);

    process.env.OCLIF_COLUMNS = 'wide';
    expect(terminalWidth()).toBe(120);

    // Partially-numeric values are rejected (strict `Number(...)`, not
    // `parseInt`), so `"80cols"` does not accidentally pin the width to 80.
    process.env.OCLIF_COLUMNS = '80cols';
    expect(terminalWidth()).toBe(120);
  });

  it('falls back to oclif settings.columns when OCLIF_COLUMNS is unset', () => {
    settings.columns = 123;
    // Even a real/non-TTY width must not win over an explicit settings.columns.
    setTty(false);

    expect(terminalWidth()).toBe(123);
  });

  it('prefers OCLIF_COLUMNS over settings.columns', () => {
    process.env.OCLIF_COLUMNS = '100';
    settings.columns = 55;
    setTty(true, 200);

    expect(terminalWidth()).toBe(100);
  });

  it('clamps a very narrow TTY width up to 40', () => {
    setTty(true, 20);

    expect(terminalWidth()).toBe(40);
  });

  it('passes a wide TTY width through unclamped', () => {
    setTty(true, 200);

    expect(terminalWidth()).toBe(200);
  });

  it('reads OCLIF_COLUMNS per-call (not memoised at import)', () => {
    process.env.OCLIF_COLUMNS = '50';
    expect(terminalWidth()).toBe(50);

    process.env.OCLIF_COLUMNS = '120';
    expect(terminalWidth()).toBe(120);
  });
});

describe('wrap', () => {
  const originalColumns = process.env.OCLIF_COLUMNS;
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    process.stdout,
    'isTTY',
  );

  afterEach(() => {
    if (originalColumns === undefined) {
      delete process.env.OCLIF_COLUMNS;
    } else {
      process.env.OCLIF_COLUMNS = originalColumns;
    }

    if (originalDescriptor) {
      Object.defineProperty(process.stdout, 'isTTY', originalDescriptor);
    }
  });

  it('soft-wraps whitespace-separated prose at the terminal width', () => {
    process.env.OCLIF_COLUMNS = '20';
    const text = 'the quick brown fox jumps over the lazy dog';

    const wrapped = wrap(text);
    const lines = wrapped.split('\n');

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(20);
    }
  });

  it('never splits an unbreakable token mid-token', () => {
    process.env.OCLIF_COLUMNS = '20';
    const path =
      'specs/deeply/nested/openapi-specification-file-v3.yaml#/components';

    // A token with no break points must stay on a single line so it can still
    // be copy-pasted and grepped, even though it overflows the width.
    expect(wrap(path)).toBe(path);
  });

  it('emits text verbatim when there is no finite width (non-TTY)', () => {
    delete process.env.OCLIF_COLUMNS;
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: false,
    });
    const text = 'the quick brown fox jumps over the lazy dog';

    expect(wrap(text)).toBe(text);
  });

  it('reserves indentColumns from the available width', () => {
    process.env.OCLIF_COLUMNS = '20';
    const text = 'the quick brown fox jumps over the lazy dog';

    const wrapped = wrap(text, 5);

    for (const line of wrapped.split('\n')) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(15);
    }
  });

  it('measures by visible width and keeps ANSI codes intact', () => {
    process.env.OCLIF_COLUMNS = '10';
    const coloured = red('hello world this is long');

    const wrapped = wrap(coloured);

    // Colour codes survive.
    expect(wrapped).toContain(`${ESC}[31m`);
    // Every wrapped line is measured by visible width (ANSI ignored), so no
    // line's visible content exceeds the pinned width.
    const wrappedLines = wrapped.split('\n');
    expect(wrappedLines.length).toBeGreaterThan(1);
    for (const line of wrappedLines) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(10);
    }
    // All the original words survive across the wrapped lines (wrap-ansi drops
    // the whitespace it wraps at, so re-join on spaces to compare word order).
    expect(stripAnsi(wrapped).split(/\s+/).join(' ')).toBe(
      'hello world this is long',
    );
  });
});

describe('wrapIndented', () => {
  const originalColumns = process.env.OCLIF_COLUMNS;

  afterEach(() => {
    if (originalColumns === undefined) {
      delete process.env.OCLIF_COLUMNS;
    } else {
      process.env.OCLIF_COLUMNS = originalColumns;
    }
  });

  it('renders nothing for empty content (no dangling glyph line)', () => {
    expect(wrapIndented('', '  ├── ')).toEqual([]);
  });

  it('hang-indents by terminal-column width for wide-glyph prefixes', () => {
    process.env.OCLIF_COLUMNS = '20';
    // `你` is a double-width (2-column) glyph; the prefix `你 ` occupies 3
    // columns even though its `.length` is 2. Continuation lines must align to
    // the 3-column content position, matching where `wrap-ansi` breaks.
    const lines = wrapIndented('word '.repeat(20).trim(), '你 ');

    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0]!.startsWith('你 ')).toBe(true);
    for (const line of lines.slice(1)) {
      expect(line.startsWith('   ')).toBe(true); // 3 spaces, not 2
      expect(line[3]).not.toBe(' ');
    }
  });

  it('applies the glyph to the first line only and hang-indents the rest', () => {
    process.env.OCLIF_COLUMNS = '20';
    const text = 'a very long finding message that must wrap several times';

    const lines = wrapIndented(text, '  ├── ');

    expect(lines.length).toBeGreaterThan(1);
    // First line carries the glyph.
    expect(lines[0]!.startsWith('  ├── ')).toBe(true);
    // Continuation lines align under the content with equal-width spaces and
    // never repeat the glyph.
    for (const line of lines.slice(1)) {
      expect(line.startsWith('      ')).toBe(true);
      expect(line).not.toContain('├──');
    }
    // Every produced line stays within the pinned width.
    for (const line of lines) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(20);
    }
  });

  it('preserves the content column across all lines', () => {
    process.env.OCLIF_COLUMNS = '24';
    const lines = wrapIndented('word '.repeat(20).trim(), '    - ');

    const contentColumn = 6; // '    - '.length
    for (const line of lines) {
      expect(line.slice(0, contentColumn).trim()).toMatch(/^(-)?$/);
    }
    expect(lines[0]!.startsWith('    - ')).toBe(true);
    for (const line of lines.slice(1)) {
      expect(line.startsWith('      ')).toBe(true);
    }
  });
});
