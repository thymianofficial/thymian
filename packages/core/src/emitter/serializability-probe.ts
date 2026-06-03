export type SerializabilityViolation = {
  path: string;
  reason: string;
  kind:
    | 'function'
    | 'class-instance'
    | 'builtin'
    | 'symbol'
    | 'bigint'
    | 'cycle';
};

export type ProbeResult =
  | { ok: true }
  | { ok: false; violations: SerializabilityViolation[] };

const BUILTIN_TAGS = new Set([
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Date',
  'RegExp',
  'Promise',
  'Error',
  'ArrayBuffer',
  'DataView',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
]);

export function probe(value: unknown): ProbeResult {
  const violations: SerializabilityViolation[] = [];
  walk(value, '$', new WeakSet(), violations);
  return violations.length === 0 ? { ok: true } : { ok: false, violations };
}

function walk(
  value: unknown,
  path: string,
  seen: WeakSet<object>,
  out: SerializabilityViolation[],
): void {
  if (value === null) {
    return;
  }

  const type = typeof value;

  if (type === 'string' || type === 'number' || type === 'boolean') {
    return;
  }

  if (type === 'undefined') {
    // undefined is dropped by JSON.stringify; treat it as serializable.
    return;
  }

  if (type === 'function') {
    out.push({
      path,
      kind: 'function',
      reason: 'functions are not serializable',
    });
    return;
  }

  if (type === 'symbol') {
    out.push({
      path,
      kind: 'symbol',
      reason: 'symbol values are not serializable',
    });
    return;
  }

  if (type === 'bigint') {
    out.push({
      path,
      kind: 'bigint',
      reason: 'bigint values are not serializable as JSON',
    });
    return;
  }

  if (type !== 'object') {
    return;
  }

  const obj = value as object;

  if (seen.has(obj)) {
    out.push({
      path,
      kind: 'cycle',
      reason: 'cyclic reference is not JSON-serializable',
    });
    return;
  }
  seen.add(obj);

  try {
    const tag = builtinTag(obj);
    if (tag) {
      out.push({
        path,
        kind: 'builtin',
        reason: `${tag} is not a JSON-serializable value`,
      });
      return;
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        walk(obj[i], `${path}[${i}]`, seen, out);
      }
      return;
    }

    // Plain objects only. Anything with a non-Object prototype is a class instance
    // and not safe to pass over a wire (methods, accessors, non-enumerable state).
    const proto = Object.getPrototypeOf(obj);
    if (proto !== Object.prototype && proto !== null) {
      out.push({
        path,
        kind: 'class-instance',
        reason: `value is an instance of ${proto?.constructor?.name ?? 'unknown class'}`,
      });
      return;
    }

    for (const key of Reflect.ownKeys(obj)) {
      if (typeof key === 'symbol') {
        out.push({
          path: `${path}.${String(key)}`,
          kind: 'symbol',
          reason: 'symbol-keyed property is not serializable',
        });
        continue;
      }
      walk((obj as Record<string, unknown>)[key], `${path}.${key}`, seen, out);
    }
  } finally {
    seen.delete(obj);
  }
}

function builtinTag(obj: object): string | undefined {
  const tag = Object.prototype.toString.call(obj).slice(8, -1);
  return BUILTIN_TAGS.has(tag) ? tag : undefined;
}
