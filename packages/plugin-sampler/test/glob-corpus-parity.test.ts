import { describe, expect, it } from 'vitest';

import {
  CORPUS,
  CORPUS_PATHS,
  EMPTY_GLOBS,
  REQUIRED_COVERAGE,
} from '../bench/glob-corpus.js';
import { matchesPathGlob } from '../src/selectors/path-glob.js';

/**
 * The corpus is the grammar, stated as data. The shipped matcher is checked
 * against it and nothing else, so an implementation that drifts from the
 * grammar cannot pass by agreeing with itself.
 */
describe('path-glob parity with the frozen corpus', () => {
  it('covers every clause the grammar states', () => {
    const covered = new Set([
      ...CORPUS.map((entry) => entry.covers),
      ...EMPTY_GLOBS.map((entry) => entry.covers),
    ]);

    for (const clause of REQUIRED_COVERAGE) {
      expect(covered.has(clause), clause).toBe(true);
    }
  });

  it('is the 31-case corpus the feasibility gate froze', () => {
    expect(CORPUS).toHaveLength(31);
  });

  it.each(CORPUS.map((entry) => [entry.glob, entry.path, entry] as const))(
    'matches(%s, %s)',
    (glob, path, entry) => {
      expect(matchesPathGlob(glob, path), entry.because).toBe(entry.expected);
    },
  );

  it.each(EMPTY_GLOBS.map((entry) => [entry.glob, entry] as const))(
    '%s names no path',
    (glob, entry) => {
      const matched = CORPUS_PATHS.filter((path) =>
        matchesPathGlob(glob, path),
      );

      expect(matched, entry.because).toEqual([]);
    },
  );
});
