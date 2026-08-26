import { isThymianError } from '@thymian/core';

/**
 * The single place in the hook discovery path that is allowed to perform an
 * operation which can throw on a **user-controlled value**.
 *
 * ## Why this module exists
 *
 * Three review rounds each closed one more instance of one class: a value that
 * came from a user's hook file — a module namespace, an export, an array
 * element, a registration field, a target, a thrown error — read without a
 * guard. Round 1 closed the collection path, round 2 the target path, round 3
 * three more (`Array.isArray` on an export, `error.message`, a partially
 * evaluated module). Each round guarded the instances it found and invited the
 * next round to find the ones it missed.
 *
 * Guarding instances does not close a class. Closing it needs the *next*
 * unguarded read to fail the build rather than wait for a reviewer, and that
 * takes two mechanisms, because neither is sufficient alone:
 *
 * 1. **A type error.** {@link UserValue} is opaque: it has no readable members,
 *    no call signature and no index signature, so `value.kind`, `value[0]` and
 *    `value()` are all compile errors. It is also not assignable to `object`,
 *    `unknown[]` or `Error`, so it cannot be narrowed into something readable by
 *    `instanceof` — which is exactly how round 3's `messageOf` finding slipped
 *    through `unknown`: `error instanceof Error` narrows, and `error.message`
 *    then type-checks while still running a user-written getter.
 * 2. **A lint error.** TypeScript cannot stop `(value as { kind: string }).kind`,
 *    and it happily allows the four globals that accept an unconstrained value
 *    and still throw: `Array.isArray`, `String`, `Object.keys` and
 *    `JSON.stringify`. `packages/plugin-sampler/eslint.config.mjs` bans those
 *    four plus the cast-then-read shape (`MemberExpression` whose object is a
 *    `TSAsExpression`) everywhere under `src/hooks/`, and exempts this file.
 *
 * So this module is where the casts and the four globals live, once, each inside
 * a `try`. Everywhere else, reaching a user value without a guard is a build
 * failure.
 *
 * ## What a guard is for
 *
 * Not defensive habit: `loadUserHooks` has two contracts that an escaping throw
 * breaks outright — *"never throws for user error"* and *"one broken file must
 * not hide the other nine"* (AC 6). A `get` trap, a `Symbol.toPrimitive`, a
 * `length` getter, an `ownKeys` trap and a revoked Proxy are all ordinary
 * TypeScript a user can write, and every one of them ran straight out of
 * `loadUserHooks` → `HookRunner.init` → `core.format` as an unformatted error
 * with no `file:` attribution, losing every healthy sibling in the scan.
 */

declare const userValueBrand: unique symbol;

/**
 * A value that came out of user code.
 *
 * Opaque by construction: nothing can be read off it, called on it or narrowed
 * out of it without going through this module. The brand is `declare`d and never
 * assigned, so no runtime cost and no way to forge one outside {@link userValue}.
 */
export type UserValue = { readonly [userValueBrand]: 'user-controlled' };

/**
 * Marks a value as user-controlled. The one entry point.
 *
 * This is a labelling operation, not a conversion — the value is unchanged. It
 * exists so the *type* records where the value came from, and so every read of
 * it after this point has to be a guarded one.
 */
export function userValue(value: unknown): UserValue {
  return value as UserValue;
}

/**
 * Hands a user value back as plain `unknown`.
 *
 * Only for values that have already been type-checked with {@link asFunction},
 * {@link asString} or {@link asFiniteNumber} and are being stored in a snapshot,
 * or for identity comparison (`Set.has`), which reads nothing.
 */
export function raw(value: UserValue): unknown {
  return value;
}

/** A read that either produced a value or threw the user's error. */
export type Read<T> = { ok: true; value: T } | { ok: false; error: unknown };

function ok<T>(value: T): Read<T> {
  return { ok: true, value };
}

function threw(error: unknown): Read<never> {
  return { ok: false, error };
}

/**
 * `typeof`, which is total: it triggers no trap and cannot throw, on any value
 * including a revoked Proxy. The one question that can always be asked.
 */
export function typeOf(value: UserValue): string {
  return typeof (value as unknown);
}

/**
 * `value == null`, which the opaque type would otherwise reject as a comparison
 * with no overlap. Reads nothing and runs no trap, so it needs no guard.
 */
export function isNullish(value: UserValue): boolean {
  const target = value as unknown;

  return target === null || target === undefined;
}

/**
 * `String(value)` without the throw.
 *
 * `String(x)` invokes `Symbol.toPrimitive`, then `toString`, then `valueOf` —
 * all three are user code on a Proxy or a hand-rolled object, and all three may
 * throw. Every place the loader renders a user value into a message goes through
 * here.
 *
 * Accepts `unknown` rather than {@link UserValue} because thrown errors arrive
 * from `catch` as `unknown` and are user data just the same; the lint ban on
 * `String(…)` is what routes them here.
 */
export function safeString(value: unknown): string {
  try {
    return String(value);
  } catch {
    return '[unprintable value]';
  }
}

/**
 * The message of a thrown value, for a diagnostic.
 *
 * The whole body is guarded, which is the round-3 finding: `isThymianError`
 * reads `name` (and reaches `Array.isArray` on the same hostile value), and
 * `error.message` is a *getter* on a Proxy — so the read that exists to report a
 * failure threw a second failure straight out of the `catch` block that called
 * it. `instanceof Error` is not the protection it looks like: it narrows the
 * type, so `error.message` compiles, while the value behind it is still whatever
 * the user threw.
 *
 * The fallback chain ends at {@link safeString}, which is total.
 */
export function messageOf(error: unknown): string {
  try {
    if (isThymianError(error) || error instanceof Error) {
      return error.message;
    }
  } catch {
    // Reading the message failed. Fall through to `safeString`, which is total —
    // for an `Error` whose `message` getter throws, `Error.prototype.toString`
    // reads the same getter, so this honestly ends at `[unprintable value]`
    // rather than pretending to a message it could not obtain.
  }

  return safeString(error);
}

/**
 * `isThymianError` deliberately accepts a value with **no own `options`**
 * (`thymian.error.ts:20-32`), so `isThymianError(new Error('x'))` is `true` and a
 * bare `error.options.suggestions` is a `TypeError` — thrown from inside the
 * catch block that exists to turn a resolution failure into a diagnostic.
 *
 * The array is also checked element-wise: `suggestions` reaches
 * `hookResolutionError`, which joins it into the one message a user sees.
 */
export function suggestionsOf(error: unknown): string[] | undefined {
  try {
    if (!isThymianError(error)) {
      return undefined;
    }

    const suggestions: unknown = error.options?.suggestions;

    if (
      !Array.isArray(suggestions) ||
      !suggestions.every((suggestion) => typeof suggestion === 'string')
    ) {
      return undefined;
    }

    return suggestions as string[];
  } catch {
    // `?.` guards a missing `options`, not a throwing one, and `Array.isArray`
    // throws outright on a revoked Proxy. The thrown value reaching here may be
    // a Proxy of the user's making — reading it must not re-throw out of the
    // catch block that exists to turn the failure into a diagnostic.
    return undefined;
  }
}

/**
 * `Array.isArray`, which **throws** on a revoked Proxy
 * (`TypeError: Cannot perform 'IsArray' on a proxy that has been revoked`)
 * rather than answering `false`. It is a guard everywhere else in JavaScript,
 * which is precisely why it kept being written outside one.
 */
export function isArrayValue(value: UserValue): Read<boolean> {
  try {
    return ok(Array.isArray(value));
  } catch (error) {
    return threw(error);
  }
}

/**
 * Own enumerable string keys.
 *
 * `Object.keys` runs the `ownKeys` trap and then a `getOwnPropertyDescriptor`
 * trap per key, both user code. A nullish value yields no keys rather than a
 * `TypeError`, matching what the loader wants for a module that evaluated to
 * `undefined`.
 */
export function ownKeys(value: UserValue): Read<string[]> {
  try {
    // Only an object has exports. `Object.keys` on a **primitive string** yields
    // one key per character, so a CJS hook file doing `module.exports = someBigString`
    // — jiti hands the primitive straight back — turned a 5 MB string into five
    // million guarded property reads. Every other primitive already answers `[]`;
    // the string was the one that did not.
    if (typeOf(value) !== 'object' || isNullish(value)) {
      return ok([]);
    }

    return ok(Object.keys(value as object));
  } catch (error) {
    return threw(error);
  }
}

/**
 * One property, through whatever `get` trap the user installed.
 *
 * Takes a `PropertyKey` rather than a `string` because the brand check in
 * `hook-registration.ts` reads a **symbol** key on a value it has not verified.
 */
export function readProperty(
  value: UserValue,
  key: PropertyKey,
): Read<UserValue> {
  try {
    return ok(userValue((value as Record<PropertyKey, unknown>)[key]));
  } catch (error) {
    return threw(error);
  }
}

/**
 * Several properties of one value, **behind one guard**.
 *
 * A branded registration is read field by field exactly once, and a Proxy whose
 * `get` trap throws on the third field has already made the first two
 * untrustworthy — so one failure discards the whole read rather than leaving the
 * caller to reason about a half-populated record. Reading each field once also
 * matters on its own: a `get` trap is free to answer differently the second
 * time.
 */
export function readProperties<K extends string>(
  value: UserValue,
  keys: readonly K[],
): Read<Record<K, UserValue>> {
  const fields = {} as Record<K, UserValue>;

  try {
    // `new Set` so a repeated key is read once and the docblock's "exactly once"
    // is a property of this function rather than of every caller's argument.
    for (const key of new Set(keys)) {
      fields[key] = userValue((value as Record<string, unknown>)[key]);
    }
  } catch (error) {
    return threw(error);
  }

  return ok(fields);
}

/** One array element. Separate from {@link readProperty} only for the label. */
export function readIndex(value: UserValue, index: number): Read<UserValue> {
  try {
    return ok(userValue((value as unknown as unknown[])[index]));
  } catch (error) {
    return threw(error);
  }
}

/**
 * `JSON.stringify`, which throws on a circular structure, on a `BigInt`, and on
 * any throwing `toJSON` or `get` trap it walks into.
 *
 * The result is a {@link Read} rather than `string | undefined` so callers can
 * tell a **failure** from a successful `undefined`: `JSON.stringify` answers
 * `undefined` for a function or for `undefined` itself, which is not an error
 * and deserves a different fallback than a circular structure does.
 */
export function safeJson(value: UserValue): Read<string | undefined> {
  try {
    return ok(JSON.stringify(value));
  } catch (error) {
    return threw(error);
  }
}

/**
 * The value as a string, or `undefined`.
 *
 * `typeof` is total, so no guard is needed and none is claimed: a value that
 * *is* a primitive string has no traps left to run.
 */
export function asString(value: UserValue): string | undefined {
  const target = value as unknown;

  return typeof target === 'string' ? target : undefined;
}

/** The value as a finite number, or `undefined`. See {@link asString}. */
export function asFiniteNumber(value: UserValue): number | undefined {
  const target = value as unknown;

  return typeof target === 'number' && Number.isFinite(target)
    ? target
    : undefined;
}

/**
 * The value as a function, or `undefined`. See {@link asString}.
 *
 * The function is **not** called here and the loader never calls it either; it
 * is stored in a snapshot and handed to the request pipeline.
 */
export function asFunction<T>(value: UserValue): T | undefined {
  const target = value as unknown;

  return typeof target === 'function' ? (target as T) : undefined;
}
