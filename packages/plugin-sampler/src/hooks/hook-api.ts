import {
  type AfterAllCallback,
  type AfterEachCallback,
  type AuthorizeCallback,
  type BeforeAllCallback,
  type BeforeEachCallback,
  type HookRegistration,
  type HookTarget,
  registerHook,
  type SampleCallback,
} from './hook-registration.js';

/**
 * SEEDED BY STORY 575.9, OWNED BY STORY 575.6 (#582).
 *
 * This module is the runtime `@thymian/hooks` resolves to. The plugin's jiti
 * instance aliases the bare specifier `@thymian/hooks` to this file's absolute path
 * (see `load-user-hooks.ts`), which is what lets a hook file import runtime values
 * in a workspace where `sampler init` was never run.
 *
 * Two consequences of that, both load-bearing:
 *
 * - **It must live under `src/`.** `package.json`'s `files: ["dist"]` is what puts
 *   the built module in the published package, and the e2e suite installs that
 *   package globally. A module outside `src/` never reaches `dist/`.
 * - **Its runtime import graph must stay minimal.** jiti evaluates this file, and
 *   everything it imports at runtime, in its own registry. Today that graph is
 *   exactly one module: `hook-registration.js`. Everything else here is
 *   `import type`, which is erased.
 *
 * What 575.6 adds: the typed surface (selector-literal targets from the generated
 * `Endpoints`, typed callbacks, typed setters), the `hooks-api.d.ts` emitter, and
 * the set-once `defineSample` resolution error. What it must NOT add: an ambient
 * "active registry" that these functions push into. Registrations are returned
 * values because discovery is export-based (spec §9) — and because a module-scope
 * registry cannot cross the jiti realm boundary, so the instance the plugin primes
 * is never the instance the user's hook writes to. See #585's Dev Notes, "Why the
 * ambient-registry design cannot work here".
 *
 * Callbacks are stored, never invoked here. 575.8 (#584) runs them.
 */

/** Rewrites the generated request sample for the targeted transaction(s). */
export function defineSample(
  target: HookTarget,
  callback: SampleCallback,
): HookRegistration {
  return registerHook({ kind: 'defineSample', target, callback });
}

/** Runs before each request of the targeted transaction(s). */
export function beforeEach(
  target: HookTarget,
  callback: BeforeEachCallback,
): HookRegistration {
  return registerHook({ kind: 'beforeEach', target, callback });
}

/** Runs after each response of the targeted transaction(s). */
export function afterEach(
  target: HookTarget,
  callback: AfterEachCallback,
): HookRegistration {
  return registerHook({ kind: 'afterEach', target, callback });
}

/**
 * Authorizes requests. Two arities, one representation:
 *
 * - `authorize(callback)` — the **global** hook, stored as `target: undefined`.
 * - `authorize(target, callback)` — **targeted**, and it wins over the global one
 *   for the transactions it covers (spec §8).
 */
export function authorize(callback: AuthorizeCallback): HookRegistration;
export function authorize(
  target: HookTarget,
  callback: AuthorizeCallback,
): HookRegistration;
export function authorize(
  targetOrCallback: HookTarget | AuthorizeCallback,
  maybeCallback?: AuthorizeCallback,
): HookRegistration {
  if (typeof targetOrCallback === 'function') {
    return registerHook({
      kind: 'authorize',
      target: undefined,
      callback: targetOrCallback,
    });
  }

  if (typeof maybeCallback !== 'function') {
    // A plain TypeError rather than a `ThymianBaseError`: keeping
    // `@thymian/core` out of this module's runtime graph is what keeps
    // `@thymian/hooks` resolvable from a hook file with nothing installed
    // alongside it. 575.6 owns the error taxonomy for the authoring API.
    throw new TypeError(
      'authorize(target, callback) needs a callback as its second argument. ' +
        'Call authorize(callback) for the global hook.',
    );
  }

  return registerHook({
    kind: 'authorize',
    target: targetOrCallback,
    callback: maybeCallback,
  });
}

/** Runs once before the run. Carries no target (spec §6). */
export function beforeAll(callback: BeforeAllCallback): HookRegistration {
  return registerHook({ kind: 'beforeAll', callback });
}

/** Runs once after the run. Carries no target (spec §6). */
export function afterAll(callback: AfterAllCallback): HookRegistration {
  return registerHook({ kind: 'afterAll', callback });
}
