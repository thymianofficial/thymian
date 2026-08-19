import { describe, expect, it } from 'vitest';

import { fromRuntimeHeaders } from '../../src/http-fields/normalized-headers.js';

describe('fromRuntimeHeaders', () => {
  it('looks up a header case-insensitively', () => {
    const headers = fromRuntimeHeaders({ 'Content-Type': 'a' });

    expect(headers.get('content-type')).toBe('a');
  });

  it('preserves same-name multiplicity, in order', () => {
    const headers = fromRuntimeHeaders({ 'set-cookie': ['a=1', 'b=2'] });

    expect(headers.getAll('Set-Cookie')).toEqual(['a=1', 'b=2']);
  });

  it('merges case-variant duplicate keys in object-key encounter order', () => {
    const headers = fromRuntimeHeaders({
      'Set-Cookie': 'a=1',
      'set-cookie': 'b=2',
    });

    expect(headers.getAll('Set-Cookie')).toEqual(['a=1', 'b=2']);
  });

  it('merges case-variant duplicates in encounter order regardless of which case comes first', () => {
    const headers = fromRuntimeHeaders({
      'set-cookie': 'b=2',
      'Set-Cookie': 'a=1',
    });

    expect(headers.getAll('Set-Cookie')).toEqual(['b=2', 'a=1']);
  });

  it('never splits a comma-containing value', () => {
    const headers = fromRuntimeHeaders({
      'set-cookie': 'Expires=Sun, 06 Nov 1994 08:49:37 GMT',
    });

    expect(headers.getAll('set-cookie')).toEqual([
      'Expires=Sun, 06 Nov 1994 08:49:37 GMT',
    ]);
    expect(headers.get('set-cookie')).toBe(
      'Expires=Sun, 06 Nov 1994 08:49:37 GMT',
    );
  });

  it('treats an undefined runtime entry as absent', () => {
    const headers = fromRuntimeHeaders({ 'x-foo': undefined });

    expect(headers.has('x-foo')).toBe(false);
    expect(headers.get('x-foo')).toBeUndefined();
    expect(headers.getAll('x-foo')).toEqual([]);
  });

  it('reports has(false) and empty getAll for a header that was never set', () => {
    const headers = fromRuntimeHeaders({});

    expect(headers.has('x-missing')).toBe(false);
    expect(headers.get('x-missing')).toBeUndefined();
    expect(headers.getAll('x-missing')).toEqual([]);
  });

  it('lists every distinct header name, case-folded to lower case', () => {
    const headers = fromRuntimeHeaders({
      'Content-Type': 'application/json',
      'X-Request-Id': '123',
    });

    expect(headers.names().sort()).toEqual(['content-type', 'x-request-id']);
  });

  it('defaults to an empty record when called with no argument', () => {
    const headers = fromRuntimeHeaders();

    expect(headers.names()).toEqual([]);
  });

  it('treats a null record the same as an absent one', () => {
    const headers = fromRuntimeHeaders(null);

    expect(headers.names()).toEqual([]);
  });

  it('treats a null header value as absent, like undefined', () => {
    const headers = fromRuntimeHeaders({ 'x-foo': null });

    expect(headers.has('x-foo')).toBe(false);
    expect(headers.get('x-foo')).toBeUndefined();
    expect(headers.getAll('x-foo')).toEqual([]);
  });

  it('treats an empty-array header value as absent', () => {
    const headers = fromRuntimeHeaders({ 'x-foo': [] });

    expect(headers.has('x-foo')).toBe(false);
    expect(headers.get('x-foo')).toBeUndefined();
    expect(headers.getAll('x-foo')).toEqual([]);
  });

  it('does not let a mutated getAll() result corrupt later reads', () => {
    const headers = fromRuntimeHeaders({ 'set-cookie': ['a=1', 'b=2'] });

    const first = headers.getAll('set-cookie');
    first.push('INJECTED=evil');

    expect(headers.getAll('set-cookie')).toEqual(['a=1', 'b=2']);
  });
});
