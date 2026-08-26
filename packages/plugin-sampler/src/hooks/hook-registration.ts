import type { Selector } from '../selectors/selector.js';
import type {
  AfterEachResponseHook,
  AuthorizeHook,
  BeforeEachRequestHook,
} from './hook-types.js';
import { isArrayValue, raw, readProperty, userValue } from './user-value.js';

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
};

type GlobalWithCreationLog = typeof globalThis & {
  [HOOK_CREATION_LOG]?: HookCreationLog;
};

/**
 * The one log, shared across every realm in this process.
 *
 * **The slot is user-controlled, and that is not optional.** It has to live on
 * `globalThis` under a `Symbol.for` key so a hook file's realm and the plugin's
 * realm reach the same object — which means a hook file, or a version-skewed
 * `@thymian/hooks` runtime, can assign anything at all to it. Three shapes were
 * measured escaping `loadUserHooks` from here, and only one of them needed a
 * Proxy:
 *
 * - `LOG = new Proxy({…}, { get() { throw … } })` — the `created` getter throws.
 * - `LOG = { nextOrder: 0 }` — plain version skew, no hostility: `created` is
 *   `undefined` and the loader's `created.length = 0` is a `TypeError`.
 * - `LOG = Object.freeze({ …, created: Object.freeze([]) })` — assigning to
 *   `length` throws on a frozen array.
 *
 * Each one killed the whole scan, losing every healthy sibling — AC 6 exactly,
 * one layer below where the guard sweep was looking. So the slot is **validated
 * on every read**: anything that is not a usable log is replaced with a fresh
 * one. Replacing rather than throwing is the right call because the log is a
 * *diagnostic channel only* (never a discovery fallback), so a poisoned slot
 * costs the user the created-but-not-exported diagnostic and nothing else.
 */
export function hookCreationLog(): HookCreationLog {
  const scope = globalThis as GlobalWithCreationLog;

  try {
    const existing = scope[HOOK_CREATION_LOG];

    const slot = userValue(existing);
    const created = readProperty(slot, 'created');
    const isList = created.ok ? isArrayValue(created.value) : undefined;

    if (
      existing !== undefined &&
      existing !== null &&
      typeof existing.nextOrder === 'number' &&
      isList?.ok === true &&
      isList.value
    ) {
      // One write proves the slot is actually writable, which none of the
      // checks above can: a frozen `created`, or a Proxy whose `set` trap
      // throws, passes every one of them and only fails later, when
      // `registerHook` or the loader writes — by which time the throw has
      // escaped into a scan.
      //
      // `push()` with no arguments adds nothing and leaves `length` unchanged,
      // but it still performs the `Set(O, "length", …, true)` that a frozen
      // array and a `set`-trapping Proxy both refuse. Verified on both.
      existing.created.push();

      return existing;
    }
  } catch {
    // Reading or probing the slot threw. Fall through and install a fresh log.
  }

  const log: HookCreationLog = { nextOrder: 0, created: [] };

  try {
    scope[HOOK_CREATION_LOG] = log;
  } catch {
    // A non-writable slot (`Object.defineProperty(globalThis, key, {})`). The
    // returned log is then realm-local, so cross-realm creations are missed and
    // the created-but-not-exported diff under-reports — which is the same
    // "diagnostic channel degrades, discovery does not" trade as above.
  }

  return log;
}

/**
 * Stamps the brand and the monotonic creation index, records the value in the
 * shared log, and freezes it.
 *
 * Freezing is what makes "inert data object" a property of the value rather than a
 * convention: nothing downstream can turn a registration into something with
 * behaviour.
 */
export function registerHook(draft: HookRegistrationDraft): HookRegistration {
  const log = hookCreationLog();
  const order = log.nextOrder;

  log.nextOrder += 1;

  // One cast, here: TypeScript cannot see that spreading a member of the draft
  // union and adding `order` plus the brand reconstructs the corresponding member
  // of the record union. The two unions are kept in step by hand, which is why
  // they sit adjacent in this file.
  const registration = Object.freeze({
    ...draft,
    order,
    [HOOK_REGISTRATION]: true,
  }) as HookRegistration;

  log.created.push(registration);

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
