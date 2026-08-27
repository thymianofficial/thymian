import { AsyncLocalStorage } from 'node:async_hooks';

import type { Selector } from '../selectors/selector.js';
import type {
  AfterEachResponseHook,
  AuthorizeHook,
  BeforeEachRequestHook,
} from './hook-types.js';
import {
  isArrayValue,
  isNullish,
  raw,
  readProperty,
  typeOf,
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

/**
 * The collection scope's own slot — **not** a field on the creation log.
 *
 * It lived on the log for three rounds, and every defect that followed came
 * from that one decision: the log is a user-writable object this file replaces
 * whenever it looks wrong, and replacing it minted a *new*
 * `AsyncLocalStorage`. An `AsyncLocalStorage` is only useful to whoever holds
 * the same instance, so every replacement detached whatever `run()` was already
 * open. Measured two ways, neither of them hostile: a slot replaced mid-file
 * lost one registration per replacement and reported a *wrong count* rather
 * than none (3 created, 1 reported), and a second scan starting while the first
 * was awaiting silently emptied the first scan's diagnostics — the exact
 * cross-scan contamination `withCreationScope`'s docblock says
 * `AsyncLocalStorage` was chosen to prevent.
 *
 * Here it cannot be replaced. The instance is resolved once per realm and
 * memoised, and the plugin's realm resolves it in `withCreationScope` **before**
 * any hook file is evaluated — so the instance `run()` is called on is fixed
 * before user code exists, and nothing written to this slot afterwards can
 * change it.
 *
 * **Considered and declined: one guarded cross-realm cell, shared by this
 * slot and {@link HOOK_CREATION_LOG}.** The two do share a real shape — read
 * behind a `try`, validate structurally, replace via `defineProperty` when
 * a plain assignment is swallowed — and a generic `GuardedCell<T>` would cut
 * the duplication. Declined for now: this exact machinery is the one four
 * separate review rounds have hardened, each round closing a hole the
 * previous round's *fix* introduced (round 5 → 6 → 7 → 7b → 7c, this file's
 * own docblocks name every one), and the two slots are not actually
 * identical — `HOOK_CREATION_LOG` tolerates a replaced value (the log is a
 * diagnostic channel; a replacement costs nothing since round 8's rewrite),
 * while `HOOK_COLLECTION_SCOPE` must not be (a replacement after the first
 * resolution is exactly the class of bug round 7c closed). A shared
 * abstraction has to parameterise that difference correctly on the first
 * try, in code whose failure mode has repeatedly been "passes the whole
 * suite, wedges or silently drops registrations under a fixture nobody
 * wrote yet" — measured directly in this session's own mutation testing.
 * The consolidation is real; the risk of doing it now, on top of an already
 * large round, is not one this pass takes on.
 */
const HOOK_COLLECTION_SCOPE: unique symbol = Symbol.for(
  '@thymian/plugin-sampler.hook-collection-scope',
);

/**
 * Marks the collector a scan has finished with.
 *
 * `AsyncLocalStorage` propagates into timers and unresolved promises, so a hook
 * file that schedules work in its module body keeps resolving to the collector
 * of a scan that returned long ago. Measured: a `setTimeout` firing 20 ms after
 * `loadUserHooks` returned pushed **1 500** registrations into an array nobody
 * would ever read again — unbounded, and in `thymian serve` each entry retains
 * the user's callback closure. A `Symbol.for` key because the mark is set in
 * the plugin's realm and read in jiti's.
 */
const COLLECTOR_CLOSED: unique symbol = Symbol.for(
  '@thymian/plugin-sampler.hook-collector-closed',
);

/**
 * A scan's collector. The mark is read with a plain property access rather than
 * `in` — the array is one this file created and handed to its own
 * `AsyncLocalStorage`, so it is not a user value, and the lint rule that bans
 * `in` on the discovery path is aimed at values that are.
 */
type Collector = HookRegistration[] & { [COLLECTOR_CLOSED]?: boolean };

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

type GlobalWithCollectionScope = typeof globalThis & {
  [HOOK_COLLECTION_SCOPE]?: AsyncLocalStorage<HookRegistration[]>;
};

/**
 * This realm's copy of the one collection scope. Resolved once and never again:
 * a memo is what makes the instance immune to anything written to the slot
 * after the first resolution, and the plugin's realm resolves before any hook
 * file runs.
 */
let memoisedScope: AsyncLocalStorage<HookRegistration[]> | undefined;

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

  // And that is the whole check.
  //
  // Every field this predicate used to interrogate has lost its readers. The
  // collection scope moved to {@link sharedCollectionScope}, so the log is no
  // longer the channel; `nextOrder` is written and never read, since the
  // creation index is realm-local; and `created` is reached only through the
  // guarded write in {@link recordCreation}. What is left has no consequence to
  // guard.
  //
  // The `isWritableDataProperty(slot, 'nextOrder', 'number')` gate that stood
  // here last was not merely inert, it was **net negative**: a slot of the shape
  // `{ get nextOrder() { return 0; }, created: [], scope: <real> }` — a working
  // shared log whose only flaw is a getter on a field nothing reads — failed it
  // and was evicted, destroying the cross-realm sharing the slot exists for. Its
  // stated justification was that it proved the object would take a write, and
  // the one write that matters is already inside a `try` that recovers.
  return true;
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
    scope: sharedCollectionScope(),
  };
}

/**
 * Installs a fresh log in the slot, returning it. Never throws.
 *
 * The write is read back, and a swallowed one is retried as a **data property
 * definition**. `globalThis[key] = log` is an ordinary assignment, so against a
 * slot defined as an accessor whose `set(){}` drops the value it reports success
 * and changes nothing — and every caller reaches this function precisely because
 * the slot needs replacing. Measured: the poisoned accessor survived both scans
 * and the created-but-not-exported diagnostic stayed dead for the process, while
 * the old comment claimed the reset had evicted it. `Object.defineProperty` is
 * what actually replaces an accessor pair; assignment never can.
 *
 * When even that is refused — a non-configurable slot, or a frozen `globalThis`
 * — the returned log is realm-local. Cross-realm creations are then missed and
 * the diff under-reports: a diagnostic channel degrading, which is the trade
 * this whole file makes deliberately, and the one case where it is forced.
 */
function resetCreationLog(): HookCreationLog {
  const log = freshCreationLog();

  const scope: GlobalWithCreationLog = globalThis;

  try {
    scope[HOOK_CREATION_LOG] = log;

    if (scope[HOOK_CREATION_LOG] === log) {
      return log;
    }
  } catch {
    // A non-writable data property throws here; `defineProperty` may still be
    // able to replace it, so fall through rather than give up.
  }

  try {
    Object.defineProperty(globalThis, HOOK_CREATION_LOG, {
      configurable: true,
      enumerable: false,
      writable: true,
      value: log,
    });
  } catch {
    // Non-configurable, or a frozen `globalThis`. See the docblock.
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
 *
 * **Nothing here carries the collection channel any more, and that is the
 * point.** For three rounds the scope lived on this object, so every branch
 * below was load-bearing and every one of them was a way to lose creations: the
 * replacement paths run on the **creation path** too — `registerHook` calls this
 * function per registration — and each replacement minted a new
 * `AsyncLocalStorage`, detaching the collector the scan had already opened.
 * Measured: three registrations created, *one* reported. A wrong count, not a
 * missing one.
 *
 * So the channel moved to {@link sharedCollectionScope}, where it cannot be
 * replaced, and what remains here is bookkeeping for the published
 * `HookCreationLog` shape. A replacement now costs nothing, which is why the
 * validation above could shrink to almost nothing: there is no longer a
 * consequence to protect.
 *
 * No test distinguishes the eviction paths any more — verified by mutation, and
 * recorded rather than hidden. They are kept because a slot holding something
 * that is not a log would otherwise accumulate writes nobody can read, and
 * because deleting them would leave `resetCreationLog` with no caller.
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
    // A slot that answers with a **different object on every read** is not a
    // shared log at all, and it fails silently rather than loudly. The `scope`
    // repair below lands on that read's throwaway, so nothing looks wrong; then
    // `withCreationScope` and `registerHook` read it again and each get their
    // own `AsyncLocalStorage`, so `getStore()` is `undefined` forever and every
    // created-but-not-exported registration goes unreported — measured as
    // `errors: []` on a scan that had one. A lazily defaulted accessor reaches
    // this without any hostility at all. Replacing it puts a plain data property
    // back, which is what makes the slot stable.
    if (scope[HOOK_CREATION_LOG] !== existing) {
      return resetCreationLog();
    }
  } catch {
    return resetCreationLog();
  }

  try {
    // Mirror the one collection scope onto the published field.
    //
    // This is bookkeeping, not plumbing. Nothing in this file reads
    // `log.scope` any more — collection goes through
    // {@link sharedCollectionScope}, which is where it should have been from
    // the start — but the field is part of the `HookCreationLog` shape and a
    // skewed runtime may read it, so it is kept pointing at the real thing
    // rather than left stale or half-installed.
    //
    // Deliberately not read back. The write is a courtesy to a reader outside
    // this file; if a slot swallows it, nothing here notices and nothing here
    // breaks. An earlier round verified this write and then had to verify the
    // verification, which is what happens when a channel is run over ground the
    // user can write.
    if (existing.scope !== sharedCollectionScope()) {
      existing.scope = sharedCollectionScope();
    }
  } catch {
    // A frozen, sealed or getter-only `scope`, or an accessor that throws.
    // Nothing depends on the field, so there is nothing to recover.
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
function sharedCollectionScope(): AsyncLocalStorage<HookRegistration[]> {
  const slot: GlobalWithCollectionScope = globalThis;

  if (memoisedScope !== undefined) {
    // Resolved already — but keep the slot pointing at it.
    //
    // The memo is what this realm uses; the slot is how the *other* realm finds
    // the same instance. Let them drift and the two halves of the channel come
    // apart silently: `run()` opens a collector on the memo while `getStore()`
    // in jiti's realm resolves something else and returns `undefined`, so every
    // creation is lost with no error anywhere. A hook file replacing the slot
    // does it, and so does anything that merely clears it. Measured: three
    // registrations created, **zero** reported.
    //
    // Republishing is safe in both directions because of the order things
    // happen in: the plugin's realm resolves first — `withCreationScope` calls
    // this before any hook file is evaluated — so jiti's realm adopts *its*
    // instance and republishing the same value is a no-op. Two realms cannot
    // fight over which is authoritative when only one of them can go first.
    publishScope(slot, memoisedScope);

    return memoisedScope;
  }

  try {
    const published = slot[HOOK_COLLECTION_SCOPE];

    if (published instanceof AsyncLocalStorage) {
      memoisedScope = published;

      return published;
    }
  } catch {
    // An accessor that throws. Fall through and install our own.
  }

  const fresh = new AsyncLocalStorage<HookRegistration[]>();

  publishScope(slot, fresh);
  memoisedScope = fresh;

  return fresh;
}

/** Best-effort: the slot is how another realm finds this instance. */
function publishScope(
  slot: GlobalWithCollectionScope,
  scope: AsyncLocalStorage<HookRegistration[]>,
): void {
  try {
    if (slot[HOOK_COLLECTION_SCOPE] !== scope) {
      slot[HOOK_COLLECTION_SCOPE] = scope;
    }
  } catch {
    // A frozen `globalThis`, or an accessor that refuses. The instance is then
    // realm-local, so cross-realm creations are invisible and the
    // created-but-not-exported diff under-reports — the one degradation this
    // file cannot design away, because the realms have no other way to meet.
  }
}

/**
 * Borrowed from the prototype, never looked up on the object.
 *
 * `instanceof` constrains the prototype *chain*; `scope.run(…)` is an own-property
 * lookup, and the two are not the same question. `class Evil extends
 * AsyncLocalStorage { run() { return undefined; } }` is a genuine instance, and
 * so is one carrying an own `run`. Measured from an ordinary hook file, all four
 * shapes damaged the **next, innocent** scan: a `TypeError` escaping
 * `loadUserHooks` unattributed, or a permanent wedge — verbatim the two failures
 * this file names as the worst it has had. The array twin of this hole was closed
 * by pushing through `Array.prototype`; this is the same fix on the other half.
 */
function runInScope<T>(
  scope: AsyncLocalStorage<HookRegistration[]>,
  store: HookRegistration[],
  callback: () => Promise<T>,
): Promise<T> {
  return AsyncLocalStorage.prototype.run.call(
    scope,
    store,
    callback,
  ) as Promise<T>;
}

function storeOfScope(
  scope: AsyncLocalStorage<HookRegistration[]>,
): Collector | undefined {
  return AsyncLocalStorage.prototype.getStore.call(scope) as
    Collector | undefined;
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
  const created: Collector = [];

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

  const scope = sharedCollectionScope();

  try {
    return await runInScope(scope, created, run);
  } catch (error) {
    // The scope is this file's own `AsyncLocalStorage` and the callback never
    // throws, so nothing here should be reachable. It stays because the last
    // four rounds each found a value that was trusted on the strength of a
    // check made somewhere else, and because a throw escaping here would leave
    // `loadUserHooks` with an unattributed error.
    return { error, created };
  } finally {
    // The scan is done with this collector. `AsyncLocalStorage` propagates into
    // timers and pending promises a hook file left behind, so without this mark
    // they keep pushing into an array nobody will read again — measured at 1 500
    // retained registrations, each holding the user's callback closure.
    closeCollector(created);
  }
}

/** Marks a collector as one no scan is reading any more. Never throws. */
function closeCollector(created: Collector): void {
  try {
    Object.defineProperty(created, COLLECTOR_CLOSED, {
      configurable: true,
      enumerable: false,
      value: true,
    });
  } catch {
    // Nothing else writes to this array, so this cannot fail — and if it ever
    // did, the bound in `recordCreation` is the backstop.
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
    // The same instance {@link withCreationScope} opened the scan on, and the
    // same borrowed method — this call reaches user-reachable ground too, and a
    // `getStore` looked up on the object runs whatever is there, on the
    // creation path, while the user's module body is still executing.
    const collector = storeOfScope(sharedCollectionScope());

    if (collector !== undefined && collector[COLLECTOR_CLOSED] !== true) {
      collector.push(registration);

      return;
    }

    // `created` has no readers left — collection goes through the async scope —
    // but it is part of the published `HookCreationLog` shape, so it keeps
    // receiving creations made outside any scan. Bounded, because an unbounded
    // write-only array in a long-lived process retains every callback closure
    // that was ever registered.
    //
    // Checked the same way `scope` is, and for the same reason: this is the
    // *other* call on the creation path that reaches a container a hook file
    // supplied. Routing `getStore` through {@link collectionScope} closed one and
    // left its twin two lines below — and `{ nextOrder: 0, created: { length: 0,
    // push(value) { … } } }` needs no accessor and no Proxy to reach it. Its
    // `push` ran inside the loader: measured at 2 008 ms for a busy-wait, and
    // never returning for `for (;;) {}`. The slot outlives the scan, so it ran
    // again on the next, innocent one.
    //
    // `isArrayValue` — the guarded reader, because `Array.isArray` throws on a
    // revoked Proxy — and the push goes through `Array.prototype`, so an own
    // `push` on a real array is not the function called either. Both hold
    // across the realm boundary because jiti shares Node's builtins in this
    // process, the same fact `instanceof AsyncLocalStorage` rests on. A Proxy
    // wrapping a real array still passes `Array.isArray` and can run a trap;
    // that is the residual this file accepts everywhere, and building one takes
    // deliberate effort.
    const created = userValue(log.created);
    const isArray = isArrayValue(created);

    if (isArray.ok && isArray.value) {
      const target = raw(created) as unknown[];

      if (target.length < MAX_UNSCOPED_CREATIONS) {
        Array.prototype.push.call(target, registration);
      }
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
 *
 * **The index comes from {@link highestOrder} and from nowhere else.** Three
 * rounds tried to derive it from the slot's own `nextOrder` — directly, then
 * validated, then as a floor under a validated seed — and every one of them was
 * still a number a hook file chose. Validating a seed proves it has *one*
 * successor; a scan needs one per registration. So `MAX_SAFE_INTEGER - 1` passed
 * every check and saturated on the third stamp: measured, four exports composed
 * `1243`, and because the counter is per-scan rather than per-file, one poisoned
 * file dragged an untouched sibling to `132`. There is no seed left to validate.
 *
 * Realm-local is enough, and it is exactly what the ordering contract needs: AC 2
 * requires the index to be monotonic *within a file*, and a file's registrations
 * are all stamped in the realm that evaluated it. `nextOrder` is still written,
 * because it is part of the published `HookCreationLog` shape and a skewed
 * runtime may read it — but nothing here reads it back, so a slot that refuses
 * the write now costs nothing at all and needs no replacement.
 */
export function registerHook(draft: HookRegistrationDraft): HookRegistration {
  const log = hookCreationLog();
  const order = highestOrder;

  highestOrder = order + 1;

  try {
    log.nextOrder = order + 1;
  } catch {
    // Frozen, sealed, getter-only, or a Proxy that refuses. Nothing stamps from
    // this field, so there is nothing to recover.
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
