import { describe, expect, it } from 'vitest';

import type { PathGlob } from '../src/selectors/transaction-filter.js';

/**
 * `PathGlob` is a *shape* type: `${string}*${string}`. A string with no `*` is
 * not one, which is what leaves a wildcard-free value to be checked against the
 * exact `Path` union instead — so a typo'd exact path stays a compile error
 * while a glob is free to be any string.
 *
 * The shape deliberately never touches the `Path` union: validating a glob
 * against the union was measured and rejected on language-server cost, and
 * vacuousness is checked at run and validate time instead.
 *
 * These are compile-time assertions. `expect` only exists so the file is a
 * test; what is being tested is whether this file type-checks, which is why
 * every `Rejects` case is written as a `@ts-expect-error`.
 */
describe('PathGlob shape', () => {
  it('accepts a value carrying a wildcard, anywhere', () => {
    const trailing: PathGlob = '/admin/**';
    const middle: PathGlob = '/v1/*/users';
    const leading: PathGlob = '*/users';
    const bare: PathGlob = '*';

    expect([trailing, middle, leading, bare]).toHaveLength(4);
  });

  it('rejects a wildcard-free string, so it must be an exact path', () => {
    // @ts-expect-error a string with no `*` is not a PathGlob
    const exact: PathGlob = '/admin/users';
    // @ts-expect-error and neither is a near-miss of a real path
    const typo: PathGlob = '/admin/userz';

    expect([exact, typo]).toHaveLength(2);
  });
});

/**
 * Deliberately not a corpus case.
 *
 * `bench/glob-corpus.ts` states the grammar over paths "written the way the
 * catalog actually contains them", and the catalog never yields a trailing
 * slash — so a path ending in `/` is input the grammar has no opinion about.
 * The matcher should still hold its own sentence: a trailing `**` consumes one
 * or more segments, and an empty string is not a segment, exactly as `*`
 * already refuses one.
 */
describe('a trailing ** consumes a real segment', () => {
  it.each([
    ['/admin/**', '/admin/'],
    ['/**', '/'],
    ['/v1/**', '/v1//'],
  ])('%s does not match %s', async (glob, path) => {
    const { matchesPathGlob } = await import('../src/selectors/path-glob.js');

    expect(matchesPathGlob(glob, path)).toBe(false);
  });

  it('still matches a path that has a segment to consume', async () => {
    const { matchesPathGlob } = await import('../src/selectors/path-glob.js');

    expect(matchesPathGlob('/admin/**', '/admin/users')).toBe(true);
    expect(matchesPathGlob('/admin/**', '/admin/users/{id}')).toBe(true);
  });
});
