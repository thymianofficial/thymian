import { describe, expect, it } from 'vitest';

import { deepMergeBody } from '../src/hooks/overlay-args.js';

/**
 * An overlay's keys are read off an ordinary JSON-shaped object a hook author
 * wrote — `args.body` — so a key like `__proto__` or `toString` is exactly as
 * legitimate as any other: a body field the description happens to name that
 * way, or a value that survived a `JSON.parse` round trip. Membership and
 * assignment must both treat it as data.
 */
describe('deepMergeBody', () => {
  it('merges ordinary object fields, deep, and replaces arrays and primitives', () => {
    expect(
      deepMergeBody(
        { name: 'Artemis', crew: ['a', 'b'], meta: { pad: 'LC-39A' } },
        { crew: ['c'], meta: { window: '2026-01-01' } },
      ),
    ).toEqual({
      name: 'Artemis',
      crew: ['c'],
      meta: { pad: 'LC-39A', window: '2026-01-01' },
    });
  });

  it('overrides with an explicit null rather than merging around it', () => {
    expect(deepMergeBody({ pad: 'LC-39A' }, { pad: null })).toEqual({
      pad: null,
    });
  });

  it('treats __proto__ as an own data key, not the prototype setter', () => {
    // Built via JSON.parse, the way a hook author's overlay usually arrives:
    // an own, enumerable, ordinary data property named "__proto__".
    const overlay = JSON.parse('{"__proto__": {"polluted": true}}') as Record<
      string,
      unknown
    >;

    const merged = deepMergeBody({ name: 'Artemis' }, overlay) as Record<
      string,
      unknown
    >;

    // The pollution this guards against: __proto__ must never repoint the
    // merged object's own prototype …
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    // … it must land as a perfectly ordinary own property instead.
    expect(Object.prototype.hasOwnProperty.call(merged, '__proto__')).toBe(
      true,
    );
    expect(merged['__proto__']).toEqual({ polluted: true });
  });

  it('does not recurse into the inherited __proto__ when base never declared it as its own', () => {
    // `'toString' in base` is true for every plain object — it is inherited —
    // but `base` never declared it as its OWN key, so the overlay's value
    // must simply replace, not merge against `Object.prototype.toString`.
    const overlay = JSON.parse('{"toString": {"x": 1}}') as Record<
      string,
      unknown
    >;

    const merged = deepMergeBody({ name: 'Artemis' }, overlay) as Record<
      string,
      unknown
    >;

    expect(merged['toString']).toEqual({ x: 1 });
  });

  it('recurses when the base itself owns the key, __proto__ included', () => {
    const base = JSON.parse('{"__proto__": {"kept": true}}') as Record<
      string,
      unknown
    >;
    const overlay = JSON.parse('{"__proto__": {"added": true}}') as Record<
      string,
      unknown
    >;

    const merged = deepMergeBody(base, overlay) as Record<string, unknown>;

    expect(merged['__proto__']).toEqual({ kept: true, added: true });
  });
});
