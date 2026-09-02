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
