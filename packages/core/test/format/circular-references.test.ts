import { describe, expect, it } from 'vitest';

import {
  resolveCircularReferences,
  resolveThymianPointers,
} from '../../src/format/circular-references';

describe('resolveCircularReferences', () => {
  it('should handle primitives without modification', () => {
    expect(resolveCircularReferences(null)).toBe(null);
    expect(resolveCircularReferences(42)).toBe(42);
    expect(resolveCircularReferences('string')).toBe('string');
    expect(resolveCircularReferences(true)).toBe(true);
  });

  it('should handle simple objects without circular references', () => {
    const obj = { a: 1, b: 'test', c: true };
    const result = resolveCircularReferences(obj);
    expect(result).toStrictEqual(obj);
  });

  it('should handle nested objects without circular references', () => {
    const obj = {
      level1: {
        level2: {
          value: 'deep',
        },
      },
    };
    const result = resolveCircularReferences(obj);
    expect(result).toStrictEqual(obj);
  });

  it('should handle arrays without circular references', () => {
    const arr = [1, 2, { a: 3 }];
    const result = resolveCircularReferences(arr);
    expect(result).toStrictEqual(arr);
  });

  it('should replace self-referencing circular reference with $thymian-ref', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;

    const result = resolveCircularReferences(obj);
    expect(result).toStrictEqual({
      a: 1,
      self: { '$thymian-ref': '#' },
    });
  });

  it('should handle nested circular references', () => {
    const parent: Record<string, unknown> = { name: 'parent' };
    const child = { name: 'child', parent };
    parent.child = child;

    const result = resolveCircularReferences(parent);
    expect(result).toStrictEqual({
      name: 'parent',
      child: {
        name: 'child',
        parent: { '$thymian-ref': '#' },
      },
    });
  });

  it('should handle circular references in arrays', () => {
    const arr: any[] = [1, 2];
    arr.push(arr);

    const result = resolveCircularReferences(arr);
    expect(result).toEqual([1, 2, { '$thymian-ref': '#' }]);
  });

  it('should do not replace multiple references to the same object without circular reference', () => {
    const shared = { value: 'shared' };
    const obj = {
      ref1: shared,
      ref2: shared,
    };

    const result = resolveCircularReferences(obj);
    expect(result).toStrictEqual({
      ref1: { value: 'shared' },
      ref2: { value: 'shared' },
    });
  });

  it('should generate correct paths for deeply nested circular references', () => {
    const obj: any = {
      a: {
        b: {
          c: {},
        },
      },
    };
    obj.a.b.c.backToRoot = obj;
    obj.a.b.c.backToA = obj.a;

    const result = resolveCircularReferences(obj);
    expect(result).toEqual({
      a: {
        b: {
          c: {
            backToRoot: { '$thymian-ref': '#' },
            backToA: { '$thymian-ref': '#/a' },
          },
        },
      },
    });
  });

  it('should handle complex object with multiple circular references', () => {
    const nodeA: Record<string, unknown> = { id: 'A' };
    const nodeB: Record<string, unknown> = { id: 'B' };
    const nodeC: Record<string, unknown> = { id: 'C' };

    nodeA.next = nodeB;
    nodeB.next = nodeC;
    nodeC.next = nodeA;

    const result = resolveCircularReferences({ root: nodeA });
    expect(result).toEqual({
      root: {
        id: 'A',
        next: {
          id: 'B',
          next: {
            id: 'C',
            next: { '$thymian-ref': '#/root' },
          },
        },
      },
    });
  });

  it('should not use references for arrays with non-circular object references', () => {
    const item = { id: 1 };
    const arr = [item, item];

    const result = resolveCircularReferences(arr);
    expect(result).toEqual([{ id: 1 }, { id: 1 }]);
  });
});

describe('resolveThymianPointers', () => {
  it('should handle primitives without modification', () => {
    expect(resolveThymianPointers(null)).toBe(null);
    expect(resolveThymianPointers(42)).toBe(42);
    expect(resolveThymianPointers('string')).toBe('string');
    expect(resolveThymianPointers(true)).toBe(true);
  });

  it('should handle objects without $thymian-ref pointers', () => {
    const obj = { a: 1, b: { c: 2 } };
    const result = resolveThymianPointers(obj);
    expect(result).toEqual(obj);
  });

  it('should resolve simple $thymian-ref pointer to root', () => {
    const obj = {
      a: 1,
      self: { '$thymian-ref': '#' },
    };

    const result = resolveThymianPointers(obj);
    expect(result.self).toBe(result);
    expect(result.a).toBe(1);
  });

  it('should resolve $thymian-ref pointer to nested property', () => {
    const obj = {
      target: { value: 'shared' },
      ref: { '$thymian-ref': '#/target' },
    };

    const result = resolveThymianPointers(obj);
    expect(result.ref).toBe(result.target);
    expect(result.ref).toEqual({ value: 'shared' });
  });

  it('should resolve multiple $thymian-ref pointers', () => {
    const obj = {
      original: { data: 'test' },
      ref1: { '$thymian-ref': '#/original' },
      ref2: { '$thymian-ref': '#/original' },
    };

    const result = resolveThymianPointers(obj);
    expect(result.ref1).toBe(result.original);
    expect(result.ref2).toBe(result.original);
    expect(result.ref1).toBe(result.ref2);
  });

  it('should resolve $thymian-ref in arrays', () => {
    const obj = {
      item: { id: 1 },
      list: [{ '$thymian-ref': '#/item' }],
    };

    const result = resolveThymianPointers(obj);
    expect(result.list[0]).toBe(result.item);
  });

  it('should resolve deeply nested $thymian-ref pointers', () => {
    const obj = {
      a: {
        b: {
          c: { value: 'deep' },
        },
      },
      ref: { '$thymian-ref': '#/a/b/c' },
    };

    const result = resolveThymianPointers(obj);
    expect(result.ref).toBe(result.a.b.c);
    expect(result.ref).toEqual({ value: 'deep' });
  });

  it('should resolve $thymian-ref with array indices', () => {
    const arr = [{ id: 0 }, { id: 1 }, { '$thymian-ref': '#/0' }];

    const result = resolveThymianPointers(arr);
    expect(result[2]).toBe(result[0]);
    expect(result[2]).toEqual({ id: 0 });
  });

  it('should throw error for invalid $thymian-ref pointer', () => {
    const obj = {
      ref: { '$thymian-ref': '#/nonexistent' },
    };

    expect(() => resolveThymianPointers(obj)).toThrow(
      'Pointer #/nonexistent could not be resolved.',
    );
  });

  it('should throw error for invalid deeply nested pointer', () => {
    const obj = {
      a: { b: {} },
      ref: { '$thymian-ref': '#/a/b/c/d' },
    };

    expect(() => resolveThymianPointers(obj)).toThrow(
      'Pointer #/a/b/c/d could not be resolved.',
    );
  });

  it('should restore circular structure from resolved references', () => {
    const obj = {
      a: {
        b: {
          backToRoot: { '$thymian-ref': '#' },
        },
      },
    };

    const result = resolveThymianPointers(obj);
    expect(result.a.b.backToRoot).toBe(result);
  });

  it('should handle complex circular graph restoration', () => {
    const obj = {
      root: {
        id: 'A',
        next: {
          id: 'B',
          next: {
            id: 'C',
            next: { '$thymian-ref': '#/root' },
          },
        },
      },
    };

    const result = resolveThymianPointers(obj);
    expect(result.root.next.next.next).toBe(result.root);
  });

  it('should work as inverse of resolveCircularReferences', () => {
    const original: any = {
      shared: { value: 'test' },
    };
    original.ref1 = original.shared;
    original.ref2 = original.shared;

    const resolved = resolveCircularReferences(original);
    const restored = resolveThymianPointers(resolved);

    expect(restored.ref1).toStrictEqual(restored.shared);
    expect(restored.ref2).toStrictEqual(restored.shared);
  });

  it('should restore self-referencing structure', () => {
    const obj: Record<string, any> = {
      a: 1,
      self: { '$thymian-ref': '#' },
    };

    const result = resolveThymianPointers(obj);
    expect(result.self).toBe(result);
    expect(result.self.self).toBe(result);
  });
});
