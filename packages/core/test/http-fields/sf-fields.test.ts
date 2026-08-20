import { describe, expect, it } from 'vitest';

import { fromRuntimeHeaders } from '../../src/http-fields/normalized-headers.js';
import {
  createSfHeaderRegistry,
  NATIVELY_SF_HEADERS,
} from '../../src/http-fields/sf-fields.js';
import { parseSfField } from '../../src/http-fields/sf-parse.js';

describe('NATIVELY_SF_HEADERS', () => {
  it('ships empty -- no header is registered until the header-grammar work populates it', () => {
    expect(NATIVELY_SF_HEADERS).toEqual({});
  });
});

describe('createSfHeaderRegistry', () => {
  it('defaults to NATIVELY_SF_HEADERS (empty) when called with no entries', () => {
    const registry = createSfHeaderRegistry();

    expect(registry.isNativelySf('x-anything')).toBe(false);
    expect(registry.fieldTypeOf('x-anything')).toBeUndefined();
  });

  it('resolves a registered name case-insensitively', () => {
    const registry = createSfHeaderRegistry({ 'X-Test-Dict': 'dictionary' });

    expect(registry.isNativelySf('x-test-dict')).toBe(true);
    expect(registry.isNativelySf('X-TEST-DICT')).toBe(true);
    expect(registry.fieldTypeOf('x-test-dict')).toBe('dictionary');
    expect(registry.fieldTypeOf('X-TEST-DICT')).toBe('dictionary');
  });

  it('reports an arbitrary unregistered name as not natively SF', () => {
    const registry = createSfHeaderRegistry({ 'X-Test-Dict': 'dictionary' });

    expect(registry.isNativelySf('x-some-other-header')).toBe(false);
    expect(registry.fieldTypeOf('x-some-other-header')).toBeUndefined();
  });

  it('resolves a case-variant duplicate key via last-write-wins', () => {
    const registry = createSfHeaderRegistry({
      'X-Test': 'item',
      'x-test': 'list',
    });

    expect(registry.fieldTypeOf('x-test')).toBe('list');
  });
});

describe('parseSfField', () => {
  it('delegates a registered dictionary field to structured-headers and returns a matching Dictionary', () => {
    const registry = createSfHeaderRegistry({ 'X-Test-Dict': 'dictionary' });

    const result = parseSfField(registry, 'X-Test-Dict', 'a=?0, b, c; foo=bar');

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected ok result');
    }
    expect(result.fieldType).toBe('dictionary');
    expect(result.value).toBeInstanceOf(Map);
    expect([...(result.value as Map<string, unknown>).keys()]).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('delegates a registered list field to structured-headers', () => {
    const registry = createSfHeaderRegistry({ 'X-Test-List': 'list' });

    const result = parseSfField(registry, 'X-Test-List', 'sugar, tea, rum');

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected ok result');
    }
    expect(result.fieldType).toBe('list');
    expect(Array.isArray(result.value)).toBe(true);
    expect((result.value as unknown[]).length).toBe(3);
  });

  it('delegates a registered item field to structured-headers', () => {
    const registry = createSfHeaderRegistry({ 'X-Test-Item': 'item' });

    const result = parseSfField(registry, 'X-Test-Item', 'foo;a=1');

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected ok result');
    }
    expect(result.fieldType).toBe('item');
    expect(Array.isArray(result.value)).toBe(true);
  });

  it('joins multi-value input (NormalizedHeaders.getAll() shape) with ", " before parsing', () => {
    const registry = createSfHeaderRegistry({ 'X-Test-List': 'list' });

    const joined = parseSfField(registry, 'X-Test-List', 'sugar, tea, rum');
    const split = parseSfField(registry, 'X-Test-List', ['sugar', 'tea, rum']);

    expect(split.ok).toBe(true);
    expect(split).toEqual(joined);
  });

  it('accepts a real NormalizedHeaders.getAll() return value end-to-end', () => {
    const registry = createSfHeaderRegistry({ 'X-Test-List': 'list' });
    const headers = fromRuntimeHeaders({
      'X-Test-List': ['sugar', 'tea, rum'],
    });

    const result = parseSfField(
      registry,
      'X-Test-List',
      headers.getAll('X-Test-List'),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected ok result');
    }
    expect(result.fieldType).toBe('list');
    expect((result.value as unknown[]).length).toBe(3);
  });

  it('returns a parse-failure outcome (not thrown) for registered-but-invalid grammar', () => {
    const registry = createSfHeaderRegistry({ 'X-Test-Item': 'item' });

    const result = parseSfField(registry, 'X-Test-Item', '"abc');

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected a failed result');
    }
    expect(result.refused).toBe(false);
    expect(typeof result.message).toBe('string');
  });

  it('refuses Content-Security-Policy before any parse is attempted', () => {
    const registry = createSfHeaderRegistry({ 'X-Test-Dict': 'dictionary' });

    const result = parseSfField(
      registry,
      'Content-Security-Policy',
      "default-src 'self'",
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected a refused result');
    }
    expect(result.refused).toBe(true);
    expect(result.message).toMatch(/not registered as a natively/i);
  });

  it('refuses Set-Cookie before any parse is attempted', () => {
    const registry = createSfHeaderRegistry({ 'X-Test-Dict': 'dictionary' });

    const result = parseSfField(registry, 'Set-Cookie', 'id=1; SameSite=None');

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected a refused result');
    }
    expect(result.refused).toBe(true);
  });

  it('refuses an arbitrary name absent from the registry', () => {
    const registry = createSfHeaderRegistry({ 'X-Test-Dict': 'dictionary' });

    const result = parseSfField(registry, 'X-Not-Registered', '?1');

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected a refused result');
    }
    expect(result.refused).toBe(true);
  });

  it('distinguishes refusal from parse failure via the discriminant, not message text', () => {
    const registry = createSfHeaderRegistry({ 'X-Test-Item': 'item' });

    const refusal = parseSfField(registry, 'Set-Cookie', 'a=1');
    const failure = parseSfField(registry, 'X-Test-Item', '"abc');

    expect(refusal.ok).toBe(false);
    expect(failure.ok).toBe(false);
    if (refusal.ok || failure.ok) {
      throw new Error('expected both to fail');
    }
    expect(refusal.refused).toBe(true);
    expect(failure.refused).toBe(false);
  });

  it('resolves a registered name case-insensitively when parsing', () => {
    const registry = createSfHeaderRegistry({ 'X-Test-Dict': 'dictionary' });

    const result = parseSfField(registry, 'x-test-dict', 'a=?0');

    expect(result.ok).toBe(true);
  });
});
