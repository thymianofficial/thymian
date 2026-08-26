import { AsyncLocalStorage } from 'node:async_hooks';

import type { Selector } from '../selectors/selector.js';
import type {
  AfterEachResponseHook,
  AuthorizeHook,
  BeforeEachRequestHook,
} from './hook-types.js';
import {
  isNullish,
  isWritableDataProperty,
  raw,
  type Read,
  readProperty,
  typeOf,
  type UserValue,
  userValue,
} from './user-value.js';

/**
 * SEEDED BY STORY 575.9, OWNED BY STORY 575.6 (#582).
 *
 * 575.6 owns the *authoring* API: the typed `defineSample`/`beforeEach`/… surface,
 * the `hooks-api.d.ts` emitter and the set-once resolution error. What lives here is
 * only the part 575.9's loader cannot be written without — the brand, the kind
 * union, the record union, the predicate and the creation log — because AC 3 and
 * AC 5 of 575.9 are not implementable against an undefined shape.
 *
 * 575.6 extends this file in place. It does not move it and does not re-create it.
 *
 * Three properties of the shape are load-bearing for the loader and must survive
 * 575.6:
 *
 * 1. A registration is an inert **data object**, never a function and never
 *    callable. Discovery is export-based (spec §9), so a registration has to be a
 *    *value* that a hook file can `export`.
 * 2. It carries a `Symbol.for` brand, not a class identity, not a module-private
 *    `Symbol()` and not membership in a plugin-held `WeakSet`. jiti evaluates the
 *    aliased `@thymian/hooks` runtime in its own module registry, so the copy of
 *    this module the user's hook imported is a different object graph from the one
 *    the plugin imported. Only the process-wide symbol registry crosses that line.
 * 3. `sourceFile` is deliberately **not** a field. Only the loader knows which file
 *    an export came from, so the loader wraps each record in
 *    `{ registration, file, exportName }` and builds every diagnostic from that
 *    envelope.
 */

/**
 * The brand. Declared `unique symbol` so it can key the record type, and created
 * with `Symbol.for` so both realms resolve the *same* symbol.
 */
export const HOOK_REGISTRATION: unique symbol = Symbol.for(
  '@thymian/plugin-sampler.hook-registration',
);

/**
 * The creation log's `globalThis` slot. The log cannot be a module-scope variable:
 * the plugin would read its own realm's copy and always see zero, which is the very
 * realm boundary the brand exists for. This is the ONLY thing that lives on
 * `globalThis`, and it is a **diagnostic channel only** — never a discovery
 * fallback, or spec §9's export rule stops meaning anything.
 */
const HOOK_CREATION_LOG: unique symbol = Symbol.for(
  '@thymian/plugin-sampler.hook-creation-log',
);

export type HookKind =
  | 'defineSample'
  | 'beforeEach'
  | 'afterEach'
  | 'authorize'
  | 'beforeAll'
  | 'afterAll';

/**
 * The kinds this plugin version understands. A branded value carrying anything
 * else is a version skew between the installed plugin and the `@thymian/hooks`
 * runtime the hook file resolved, and the loader reports it as an error rather
 * than dropping the hook silently.
 */
export const HOOK_KINDS: ReadonlySet<string> = new Set<HookKind>([
  'defineSample',
  'beforeEach',
  'afterEach',
  'authorize',
  'beforeAll',
  'afterAll',
]);

/**
 * Placeholder for story 575.4's (#580) `TransactionFilter`. Only its *shape class*
 * is fixed here — a non-array object in the target slot — because that is all
 * `resolveTargeting` switches on. Nothing in 575.9 reads a field off it; 575.4
 * replaces this alias with the real union and fills in the one `switch` branch.
 */
export type TransactionFilter = { readonly [key: string]: unknown };

/** One shape for all four targeted kinds (spec §6). */
export type HookTarget = Selector | readonly Selector[] | TransactionFilter;

/**
 * Permissive callback placeholders; 575.6 replaces them with the typed surface.
 *
 * `beforeEach`/`afterEach`/`authorize` carry the existing runtime signatures
 * because `HookRunner` invokes them; the other three are deliberately opaque —
 * 575.8 owns running them and this story only stores them.
 */
export type BeforeEachCallback = BeforeEachRequestHook;
export type AfterEachCallback = AfterEachResponseHook;
export type AuthorizeCallback = AuthorizeHook;
export type SampleCallback = (...args: never[]) => unknown;
export type BeforeAllCallback = (...args: never[]) => unknown;
export type AfterAllCallback = (...args: never[]) => unknown;

type Brand = { readonly [HOOK_REGISTRATION]: true };

/**
 * `beforeAll` / `afterAll` carry **no `target` property at all**, so the loader
 * switches on `kind` first and only then reads `target`. It must never infer
 * global-vs-targeted from whether a `target` key exists — on `authorize`,
 * `target: undefined` *is* the global form, one representation and no second
 * boolean.
 */
export type HookRegistration = Brand &
  (
    | {
        kind: 'defineSample';
        order: number;
        target: HookTarget;
        callback: SampleCallback;
      }
    | {
        kind: 'beforeEach';
        order: number;
        target: HookTarget;
        callback: BeforeEachCallback;
      }
    | {
        kind: 'afterEach';
        order: number;
        target: HookTarget;
        callback: AfterEachCallback;
      }
    | {
        kind: 'authorize';
        order: number;
        target: HookTarget | undefined;
        callback: AuthorizeCallback;
      }
    | { kind: 'beforeAll'; order: number; callback: BeforeAllCallback }
    | { kind: 'afterAll'; order: number; callback: AfterAllCallback }
  );

/** What a factory hands to {@link registerHook}: the record minus brand and order. */
export type HookRegistrationDraft =
  | { kind: 'defineSample'; target: HookTarget; callback: SampleCallback }
  | { kind: 'beforeEach'; target: HookTarget; callback: BeforeEachCallback }
  | { kind: 'afterEach'; target: HookTarget; callback: AfterEachCallback }
  | {
      kind: 'authorize';
      target: HookTarget | undefined;
      callback: AuthorizeCallback;
    }
  | { kind: 'beforeAll'; callback: BeforeAllCallback }
  | { kind: 'afterAll'; callback: AfterAllCallback };

/**
 * Every registration created in this process, and the counter that stamps their
 * `order`.
 *
 * `created` exists for exactly one diagnostic: a registration the user built but
 * forgot to export (`beforeEach(sel, fn);` on its own line) is invisible to
 * export-based discovery and would silently do nothing. The loader clears it before
 * each file's import and reads it after.
 *
 * `nextOrder` is what makes `order` monotonic across every file of a scan, which is
 * what gives composition order *within* a file a source that does not depend on
 * `Object.values(namespace)` — an ESM namespace exposes its string keys sorted, so
 * export order is not registration order.
 */
export type HookCreationLog = {
  nextOrder: number;
  created: HookRegistration[];
  /**
   * Where a creation goes while a scan is collecting. See
   * {@link withCreationScope}.
   *
   * An `AsyncLocalStorage`, and it lives **on the log** rather than in a module
   * variable for the same reason the log does: jiti evaluates the aliased
   * `@thymian/hooks` in its own registry, so the hook file's realm holds a
   * different module instance of this file. Only what is reachable through the
   * shared slot is shared.
   *
   * Optional so a log written by a **skewed runtime** that predates it is still
   * a usable log rather than a rejected one.
   */
  scope?: AsyncLocalStorage<HookRegistration[]>;
};

type GlobalWithCreationLog = typeof globalThis & {
  [HOOK_CREATION_LOG]?: HookCreationLog;
};

/**
 * Is this slot a log we can actually use — **without writing to it to find out**?
 *
 * The slot lives on `globalThis` under a `Symbol.for` key because it has to: a
 * hook file's realm and the plugin's realm must reach the same object, and only
 * the process-wide symbol registry crosses that line. So a hook file, or a
 * version-skewed `@thymian/hooks`, can assign anything to it, and every shape
 * below was measured destroying a scan — most of them with no Proxy at all:
 *
 * | slot | what broke |
 * | --- | --- |
 * | `{ nextOrder: 0 }` | `created` is `undefined` |
 * | `Object.freeze({ …, created: Object.freeze([]) })` | writing `created.length` |
 * | `Object.freeze({ …, created: [] })` | writing `nextOrder` |
 * | `{ get nextOrder() { return 0 }, created: [] }` | writing `nextOrder` |
 * | `{ …, created: Object.seal([x]) }` | `push` cannot extend a sealed array |
 * | Proxy with a throwing `created` getter | reading `created` |
 *
 * An earlier version proved writability by *calling* `created.push()`. That was
 * wrong twice over: a zero-argument `push` only re-sets `length`, so it accepted
 * a **sealed** array that `registerHook`'s real `push(value)` then rejects; and
 * on a `created` carrying its own `push`, the probe **ran user code and kept its
 * side effects** — measured appending two junk entries that were then reported
 * as created-but-not-exported against an innocent file, for the lifetime of the
 * process.
 *
 * So validation is structural only: property descriptors and
 * `isFrozen`/`isSealed`, no mutation and no user call. A Proxy can still lie
 * about all of them, which is why {@link registerHook} guards its writes too and
 * resets the slot if one fails. Two cheap nets beat one probe with side effects.
 */
function isUsableCreationLog(candidate: unknown): candidate is HookCreationLog {
  // NOTE: this predicate certifies `HookCreationLog`, which is more than it
  // checks — `created` and `scope` are asserted, not verified. That is only safe
  // because every subsequent use of both is guarded: `recordCreation` wraps its
  // writes, `hookCreationLog` verifies `scope` by identity before anyone can
  // call it, and `withCreationScope` wraps the call anyway. A type predicate
  // that launders a whole shape from one check is exactly how the `scope` hole
  // got in; the guards are the reason the remaining assertion is not another
  // one.
  const slot = userValue(candidate);

  if (typeOf(slot) !== 'object' || isNullish(slot)) {
    return false;
  }

  // One check, and it is the only one that earns its place.
  //
  // Since collection moved into an async scope, a scan never touches the slot's
  // `created` array at all — so a frozen, sealed or hostile `created` cannot
  // reach a hook file, and validating it was measurably dead weight (every
  // mutation of those checks was absorbed). What a scan *does* need is somewhere
  // to hang a collection scope and a usable `nextOrder`, because the creation
  // index is what fixes composition order within a file.
  //
  // `Object.freeze` sets `writable: false` on every data property, and a getter
  // has no `writable` at all, so this one predicate covers the frozen log, the
  // getter-only `nextOrder` and the plain `{ nextOrder: 0 }` skew that has no
  // `created`. A *sealed* object still takes the write, and that is correct: the
  // only other thing installed here is `scope`, and adding it to a sealed object
  // throws where the caller already catches.
  //
  // Reading a descriptor — not `isFrozen`/`isSealed`, which an earlier draft of
  // this comment claimed and the body never did — is also the whole reason there
  // is no probe any more. An
  // earlier version proved writability by *calling* `created.push()`, which
  // accepted a sealed array the real `push(value)` then rejects, and on a
  // `created` carrying its own `push` it ran user code and **kept the side
  // effects** — measured appending junk that was then reported against an
  // innocent file for the lifetime of the process.
  if (!isWritableDataProperty(slot, 'nextOrder', 'number')) {
    return false;
  }

  // A number is not enough: `NaN`, `Infinity` and anything at or past 2^53 all
  // pass `typeof`, and then `order + 1` either propagates `NaN` or **saturates**,
  // so every registration in the file is stamped with the same index.
  // `snapshotRegistration` maps `NaN`/`Infinity` to one shared
  // `MAX_SAFE_INTEGER`, so the composition silently reorders with no diagnostic
  // at all — measured, three hooks composed `321` instead of `123`, `errors: 0`.
  // That is precisely the failure this counter exists to prevent.
  //
  // The bound is `< MAX_SAFE_INTEGER`, not `<=`: `MAX_SAFE_INTEGER` itself is a
  // safe integer and passes every check above, and then `order + 1` is the
  // first value that is not — so the counter stops advancing and every
  // registration after the first is stamped identically. Measured with
  // `nextOrder: Number.MAX_SAFE_INTEGER`: three hooks composed `132` instead of
  // `123`, `errors: 0`. A usable counter is one whose *successor* exists.
  const order = readProperty(slot, 'nextOrder');

  return (
    order.ok &&
    Number.isSafeInteger(raw(order.value)) &&
    !isNegative(order) &&
    (raw(order.value) as number) < Number.MAX_SAFE_INTEGER
  );
}

/** `value < 0` for a value already known to be a safe integer. */
function isNegative(order: Read<UserValue>): boolean {
  return order.ok && (raw(order.value) as number) < 0;
}

/**
 * The highest creation index this realm has handed out.
 *
 * A replaced slot hands back `nextOrder: 0`, so without this every registration
 * after a mid-scan replacement restarted at zero — silently reordering the
 * `beforeEach` composition the index exists to fix, which is the very thing the
 * replacement was supposed to protect. Realm-local, which is enough: AC 2 only
 * needs the index to be monotonic *within* a file, and a file's registrations
 * are all stamped in the realm that evaluated it.
 */
let highestOrder = 0;

/**
 * How many out-of-scan creations the shared array will hold. See
 * {@link recordCreation}.
 */
const MAX_UNSCOPED_CREATIONS = 1_000;

function freshCreationLog(): HookCreationLog {
  return {
    nextOrder: highestOrder,
    created: [],
    scope: new AsyncLocalStorage(),
  };
}

/** Installs a fresh log in the slot, returning it. Never throws. */
function resetCreationLog(): HookCreationLog {
  const log = freshCreationLog();

  const scope: GlobalWithCreationLog = globalThis;

  try {
    scope[HOOK_CREATION_LOG] = log;
  } catch {
    // A non-writable slot (`Object.defineProperty(globalThis, key, {})`). The
    // returned log is then realm-local, so cross-realm creations are missed and
    // the created-but-not-exported diff under-reports — a diagnostic channel
    // degrading, which is the trade this whole file makes deliberately.
  }

  return log;
}

/**
 * The one log, shared across every realm in this process.
 *
 * Validated on every read; anything unusable is replaced. Replacing rather than
 * throwing is right because the log is a **diagnostic channel only** — never a
 * discovery fallback — so a poisoned slot costs the created-but-not-exported
 * diagnostic and nothing that binds a hook.
 */
export function hookCreationLog(): HookCreationLog {
  const scope: GlobalWithCreationLog = globalThis;

  let existing: HookCreationLog | undefined;

  try {
    // Inside the guard, not beside it. The slot can be defined as an **accessor**
    // (`Object.defineProperty(globalThis, key, { get() { throw … } })`), and
    // reading it then threw an unformatted `TypeError` straight out of
    // `loadUserHooks`, killing the scan with no `file:` attribution — the same
    // shape as every other finding in this story, in the one read that had been
    // moved out of a `try` while refactoring.
    existing = scope[HOOK_CREATION_LOG];
  } catch {
    return resetCreationLog();
  }

  if (!isUsableCreationLog(existing)) {
    return resetCreationLog();
  }

  try {
    // `instanceof`, not `??=`. This is the field the loader **calls**, and it
    // lives on a slot any hook file can write, so accepting whatever is there
    // was the worst hole this story has had: one line assigning
    // `{ scope: { run() { return undefined; } } }` made `withCreationScope`
    // return `undefined` and a `TypeError` escape `loadUserHooks` entirely,
    // and `{ run() { return new Promise(() => {}); } }` wedged **every future
    // scan in the process** — permanently, because the slot outlives the scan.
    // That is strictly worse than the module-global queue it replaced.
    //
    // The identity check is reliable here specifically because jiti evaluates
    // in this process and shares Node's builtins, so `node:async_hooks` is one
    // module and one class across the realm boundary the brand exists for.
    //
    // A slot installed by a runtime that predates this field is otherwise
    // perfectly usable and simply has nowhere to put a scope; repairing it in
    // place is what keeps it working. Without that, such a slot silently
    // disabled the whole channel for the rest of the process.
    if (!(existing.scope instanceof AsyncLocalStorage)) {
      existing.scope = new AsyncLocalStorage();

      // The repair is not done until the read agrees with the write.
      //
      // `scope` can be an **accessor**, and a `set scope(v) {}` that silently
      // drops the value throws nothing — so the assignment above reported
      // success while the getter kept handing back the original object.
      // Measured with a getter returning `{ run: () => new Promise(() => {}) }`:
      // `loadUserHooks` awaited forever, with no timeout and no diagnostic, and
      // because the slot outlives the scan it wedged **every later scan in the
      // process** as well — the exact failure the `instanceof` check above was
      // added to close, walked around through the one write nobody checked.
      //
      // Resetting is what evicts it: `resetCreationLog` overwrites the
      // `globalThis` property, so the poisoned object stops being reachable
      // instead of merely being tolerated once.
      if (!(existing.scope instanceof AsyncLocalStorage)) {
        return resetCreationLog();
      }
    }
  } catch {
    return resetCreationLog();
  }

  return existing;
}

/**
 * The collection scope on `log` — read **once**, and checked as the same value
 * that the caller will then use.
 *
 * Splitting the read from the check is what let the worst version of this bug
 * back in. `scope` lives on a `globalThis` slot any hook file can write, so it
 * can be an **accessor**: {@link hookCreationLog} checked one read and
 * `withCreationScope` called a later one, which on an accessor is a different
 * value. Reading it here and returning only what passed the check makes "the
 * value called is the value checked" a property of the code rather than a
 * convention two functions apart.
 *
 * The read is guarded because a getter can throw as easily as it can lie, and
 * an unguarded read of this slot has already escaped `loadUserHooks` once as an
 * unattributed `TypeError`.
 *
 * `instanceof` is reliable here specifically because jiti evaluates in this
 * process and shares Node's builtins, so `node:async_hooks` is one module and
 * one class across the realm boundary the brand exists for.
 *
 * What this deliberately does **not** defend is an own-property `run` on a
 * genuine `AsyncLocalStorage` instance. That takes a hook file sabotaging a
 * builtin it constructed itself, and no guard here would buy an invariant: a
 * hook file's module body is `await`ed, so `while (true) {}` or a top-level
 * `await new Promise(() => {})` hangs the scan regardless. The achievable
 * invariants are the two this file does hold — the loader's own machinery is
 * never the thing that hangs, and no scan can leave the slot in a state that
 * hangs the *next* one.
 */
function collectionScope(
  log: HookCreationLog,
): AsyncLocalStorage<HookRegistration[]> | undefined {
  let scope: unknown;

  try {
    scope = log.scope;
  } catch {
    return undefined;
  }

  return scope instanceof AsyncLocalStorage ? scope : undefined;
}

/**
 * Runs `evaluate` with every registration it creates going to a collector of its
 * own, and returns them.
 *
 * **Why an async scope and not a shared array.** The loader used to empty
 * `created` around each file, which made two overlapping scans destroy each
 * other's in-flight list — measured, the scan whose hook file awaited came back
 * with *no* created-but-not-exported diagnostic at all. Serialising the scans
 * fixed that and introduced something worse: a module-global queue means one
 * hook file that never settles wedges **every later scan in the process**,
 * including a different plugin instance and 575.10's `sampler validate`.
 *
 * A plain per-scan collector is not enough either: two scans interleave at every
 * `await`, so a collector that is simply "open" also catches the *other* scan's
 * creations — measured, an innocent file was told it had failed to export a
 * registration a concurrent scan had created.
 *
 * `AsyncLocalStorage` is the primitive that actually answers the question being
 * asked, which is not "which collectors are open" but "which evaluation is this
 * creation part of". The module body jiti runs sits inside this call's async
 * context, so a creation lands in exactly one collector and no scan has to wait
 * for another.
 */
export async function withCreationScope<T>(
  evaluate: () => Promise<T>,
): Promise<{ result?: T; error?: unknown; created: HookRegistration[] }> {
  const created: HookRegistration[] = [];
  const log = hookCreationLog();

  const run = async (): Promise<{
    result?: T;
    error?: unknown;
    created: HookRegistration[];
  }> => {
    try {
      return { result: await evaluate(), created };
    } catch (error) {
      return { error, created };
    }
  };

  const scope = collectionScope(log);

  if (scope === undefined) {
    // Either a skewed log that predates the field, or a slot that did not hand
    // back what it was repaired with. Creations are invisible to this
    // evaluation and the diff under-reports — a diagnostic channel degrading,
    // which is the trade this file makes deliberately. What it must never do is
    // call whatever is sitting there: that is not a degraded diagnostic, it is
    // an unbounded hang inside the loader.
    return await run();
  }

  try {
    // Belt and braces with the check inside {@link collectionScope}: that check
    // is what makes `scope` an `AsyncLocalStorage`, and this is what stops a
    // failure here escaping `loadUserHooks` if it ever is not. Both, because
    // the last three rounds each found a value that was trusted on the strength
    // of a check made somewhere else.
    return await scope.run(created, run);
  } catch (error) {
    return { error, created };
  }
}

/**
 * Records one creation in the collector for the evaluation it belongs to, or —
 * when nothing is collecting — in the shared array the type has always carried.
 */
function recordCreation(
  log: HookCreationLog,
  registration: HookRegistration,
): void {
  try {
    // Through {@link collectionScope} for the same reason
    // {@link withCreationScope} is: this call reaches the slot too, and calling
    // a `getStore` a hook file supplied runs user code on the creation path.
    const collector = collectionScope(log)?.getStore();

    if (collector !== undefined) {
      collector.push(registration);

      return;
    }

    // `created` has no readers left — collection goes through the async scope —
    // but it is part of the published `HookCreationLog` shape, so it keeps
    // receiving creations made outside any scan. Bounded, because an unbounded
    // write-only array in a long-lived process retains every callback closure
    // that was ever registered.
    if (log.created.length < MAX_UNSCOPED_CREATIONS) {
      log.created.push(registration);
    }
  } catch {
    // See `isUsableCreationLog`: a Proxy can pass validation and still refuse
    // the write. Losing the record costs a diagnostic, never a binding.
  }
}

/**
 * Stamps the brand and the monotonic creation index, records the value in the
 * shared log, and freezes it.
 *
 * Freezing is what makes "inert data object" a property of the value rather than a
 * convention: nothing downstream can turn a registration into something with
 * behaviour.
 */
/**
 * The index to stamp on the next registration.
 *
 * The realm-local counter is a **floor**, not merely the seed a replacement log
 * starts from. Nothing forces the slot's own counter to advance: a `globalThis`
 * accessor that builds a fresh `{ nextOrder: 0 }` on every read — a lazily
 * defaulted slot, not a hostile one — hands back zero every time, so every
 * registration in a file was stamped `0`. Ties do not degrade gracefully.
 * `Object.entries` on an ESM namespace yields **sorted** keys, so the creation
 * index is the only thing standing between the user's composition order and
 * alphabetical order by export name; measured, exports `one`/`two`/`three`
 * composed `132` with no diagnostic at all.
 *
 * Total by construction: a seed that is not a usable index is ignored rather
 * than propagated, because `Math.max(NaN, n)` is `NaN` and a `NaN` order is
 * exactly the collision this exists to prevent.
 */
function stampOrder(log: HookCreationLog): number {
  const seed = log.nextOrder;

  return Number.isSafeInteger(seed) && seed > highestOrder
    ? seed
    : highestOrder;
}

export function registerHook(draft: HookRegistrationDraft): HookRegistration {
  let log = hookCreationLog();
  let order = 0;

  try {
    order = stampOrder(log);
    log.nextOrder = order + 1;
  } catch {
    // Validation is structural, so a Proxy can pass it and still refuse the
    // write. Reset and retry once rather than let a poisoned slot stamp every
    // registration with the same order — which would silently reorder the
    // user's `beforeEach` composition, the one thing this counter exists for.
    // The fresh log resumes from {@link highestOrder}, so a replacement cannot
    // restart the composition index at zero.
    log = resetCreationLog();
    order = stampOrder(log);
    log.nextOrder = order + 1;
  }

  // One cast, here: TypeScript cannot see that spreading a member of the draft
  // union and adding `order` plus the brand reconstructs the corresponding member
  // of the record union. The two unions are kept in step by hand, which is why
  // they sit adjacent in this file.
  const registration = Object.freeze({
    ...draft,
    order,
    [HOOK_REGISTRATION]: true,
  }) as HookRegistration;

  highestOrder = Math.max(highestOrder, order + 1);

  recordCreation(log, registration);

  return registration;
}

/**
 * Is this value a registration produced by the `@thymian/hooks` runtime?
 *
 * `typeof value !== 'object'` rejects functions before anything else, which is what
 * makes AC 3's "functions are never invoked" a *structural* property of the
 * predicate rather than a discipline to remember. The brand is compared `=== true`,
 * so a same-keyed symbol carrying some other value cannot pass by accident, and a
 * plain data object that merely has a `kind` string is not a hook.
 *
 * The property read is guarded because a user export may be a Proxy or an accessor
 * that throws.
 */
export function isHookRegistration(value: unknown): value is HookRegistration {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  // Through `readProperty`, not a cast: `user-value.ts` is the one module
  // allowed to reach into a user-controlled value, and routing this read through
  // it is what lets the lint rule ban the cast-then-read shape everywhere else
  // on the discovery path. The guard is the same guard; it just lives once.
  const read = readProperty(userValue(value), HOOK_REGISTRATION);

  return read.ok && raw(read.value) === true;
}
