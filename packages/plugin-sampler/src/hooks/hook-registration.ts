import type { Selector } from '../selectors/selector.js';
import type { TransactionFilter } from '../selectors/transaction-filter.js';

/**
 * The brand every registration carries.
 *
 * `Symbol.for` rather than a fresh symbol: the plugin's jiti instance evaluates
 * the hooks runtime in its own module registry, so a hook file and the loader
 * hold different module instances of that file. A registry-local symbol would
 * differ between them; a well-known one is the same symbol in both realms.
 */
export const HOOK_REGISTRATION: unique symbol = Symbol.for(
  '@thymian/plugin-sampler.hook-registration',
);

export type HookKind =
  | 'defineSample'
  | 'beforeEach'
  | 'afterEach'
  | 'authorize'
  | 'beforeAll'
  | 'afterAll';

/**
 * What a per-transaction hook is aimed at: exactly one Transaction by Selector,
 * several by a list of them, or a set by a filter.
 */
export type HookTarget = Selector | readonly Selector[] | TransactionFilter;

/**
 * Callbacks are stored, never inspected. Each kind's precise signature is the
 * runner's contract, and the generated `.d.ts` is what types it for the author;
 * here they only have to be functions.
 */
export type HookCallback = (...args: never[]) => unknown;

type Brand = { readonly [HOOK_REGISTRATION]: true };

/**
 * One hook, as a value.
 *
 * A registration is **returned**, not pushed into an ambient registry, because
 * discovery is export-based: a module-scope registry in the loader's realm is
 * not the one a hook file writing `@thymian/hooks` would reach. `order` is
 * stamped at creation and is monotonic within the realm that evaluated the file,
 * which is what gives composition an order that does not depend on
 * `Object.keys(namespace)` — an ESM namespace exposes its keys sorted, so export
 * order is not registration order.
 */
export type HookRegistration = Brand &
  (
    | {
        kind: 'defineSample';
        order: number;
        target: HookTarget;
        callback: HookCallback;
      }
    | {
        kind: 'beforeEach';
        order: number;
        target: HookTarget;
        callback: HookCallback;
      }
    | {
        kind: 'afterEach';
        order: number;
        target: HookTarget;
        callback: HookCallback;
      }
    | {
        kind: 'authorize';
        order: number;
        target: HookTarget | undefined;
        callback: HookCallback;
      }
    | { kind: 'beforeAll'; order: number; callback: HookCallback }
    | { kind: 'afterAll'; order: number; callback: HookCallback }
  );

/** What a factory hands to {@link registerHook}: the record minus brand and order. */
export type HookRegistrationDraft =
  | { kind: 'defineSample'; target: HookTarget; callback: HookCallback }
  | { kind: 'beforeEach'; target: HookTarget; callback: HookCallback }
  | { kind: 'afterEach'; target: HookTarget; callback: HookCallback }
  | {
      kind: 'authorize';
      target: HookTarget | undefined;
      callback: HookCallback;
    }
  | { kind: 'beforeAll'; callback: HookCallback }
  | { kind: 'afterAll'; callback: HookCallback };

let nextOrder = 0;

/**
 * Where every registration created in this process is recorded, so the loader
 * can tell a hook that was *created* from one that was *exported*.
 *
 * `beforeEach(...)` written without `export const x =` compiles, runs, creates
 * a registration — and is then unreachable, because discovery is export-based.
 * Nothing failed, so nothing was reported: the hook simply never fired.
 *
 * On `globalThis` under a well-known symbol, for the same reason
 * {@link HOOK_REGISTRATION} is: the loader's jiti instance runs with
 * `moduleCache: false`, so this module is re-evaluated for every hook file and
 * a module-scope array would be a different array each time — including from
 * the loader's own point of view. `globalThis` is the one thing all of those
 * evaluations share.
 *
 * The loader empties it at the start of each scan and reads it per file, so it
 * holds one scan's worth of registrations rather than the process's.
 */
const CREATED_REGISTRATIONS: unique symbol = Symbol.for(
  '@thymian/plugin-sampler.created-registrations',
);

type CreatedRegistrations = {
  [CREATED_REGISTRATIONS]?: HookRegistration[];
};

/** Every registration created so far, oldest first. Mutable on purpose. */
export function createdRegistrations(): HookRegistration[] {
  const channel = globalThis as CreatedRegistrations;

  return (channel[CREATED_REGISTRATIONS] ??= []);
}

/** Freezes a draft into a branded, ordered registration. */
export function registerHook(draft: HookRegistrationDraft): HookRegistration {
  const order = nextOrder;

  nextOrder = order + 1;

  const registration = Object.freeze({
    ...draft,
    order,
    [HOOK_REGISTRATION]: true,
  }) as HookRegistration;

  createdRegistrations().push(registration);

  return registration;
}

/**
 * Is this value a registration produced by the hooks runtime?
 *
 * The `typeof value !== 'object'` test rejects functions before anything else,
 * which makes "a function is never invoked to discover a hook" a structural
 * property of this predicate rather than a discipline to remember. The brand is
 * compared `=== true`, so a same-keyed symbol carrying some other value cannot
 * pass by accident, and a plain object that merely has a `kind` string is not a
 * hook. The read is guarded because a user export may be a Proxy or an accessor
 * that throws.
 */
export function isHookRegistration(value: unknown): value is HookRegistration {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  try {
    return (value as Record<PropertyKey, unknown>)[HOOK_REGISTRATION] === true;
  } catch {
    return false;
  }
}
