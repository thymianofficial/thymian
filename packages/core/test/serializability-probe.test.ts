import { describe, expect, it } from 'vitest';

import { probe } from '../src/emitter/serializability-probe.js';

describe('serializability probe', () => {
  it('accepts plain JSON-shaped values', () => {
    expect(probe({ a: 1, b: 'x', c: [1, 2, null, { d: true }] })).toEqual({
      ok: true,
    });
  });

  it('rejects functions', () => {
    const result = probe({ handler: () => 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]?.kind).toBe('function');
      expect(result.violations[0]?.path).toBe('$.handler');
    }
  });

  it('rejects class instances', () => {
    class Box {
      value = 1;
    }
    const result = probe({ box: new Box() });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]?.kind).toBe('class-instance');
      expect(result.violations[0]?.reason).toContain('Box');
    }
  });

  it('rejects Error instances even though they look object-like', () => {
    const result = probe({ err: new Error('boom') });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]?.kind).toBe('builtin');
      expect(result.violations[0]?.reason).toContain('Error');
    }
  });

  it('rejects Maps/Sets/Dates/RegExps', () => {
    const result = probe({
      m: new Map(),
      s: new Set(),
      d: new Date(),
      r: /x/,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.map((v) => v.kind)).toEqual([
        'builtin',
        'builtin',
        'builtin',
        'builtin',
      ]);
    }
  });

  it('rejects bigint and symbol values', () => {
    const result = probe({ big: 1n, sym: Symbol('x') });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const kinds = result.violations.map((v) => v.kind).sort();
      expect(kinds).toEqual(['bigint', 'symbol']);
    }
  });

  it('detects cycles', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const result = probe(obj);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]?.kind).toBe('cycle');
    }
  });

  it('accepts shared (diamond) references without false-positive cycle reports', () => {
    const shared = { x: 1 };
    expect(probe({ a: shared, b: shared })).toEqual({ ok: true });
    expect(probe([shared, shared])).toEqual({ ok: true });
  });

  it('walks into arrays of plain objects', () => {
    const result = probe([{ ok: 1 }, { bad: () => 1 }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]?.path).toBe('$[1].bad');
    }
  });
});
