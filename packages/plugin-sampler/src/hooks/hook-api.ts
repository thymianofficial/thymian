import {
  type HookCallback,
  type HookRegistration,
  type HookTarget,
  registerHook,
} from './hook-registration.js';

/**
 * The module `@thymian/hooks` resolves to.
 *
 * The plugin's jiti instance aliases the bare specifier `@thymian/hooks` to this
 * file's absolute path, which is what lets a hook file import runtime values in
 * a workspace where `sampler init` was never run.
 *
 * Two consequences, both load-bearing:
 *
 * - **It must live under `src/`.** `package.json`'s `files: ["dist"]` is what
 *   puts the built module in the published package; a module outside `src/`
 *   never reaches `dist/`.
 * - **Its runtime import graph must stay minimal.** jiti evaluates this file,
 *   and everything it imports at runtime, in its own registry. That graph is
 *   exactly one module: `hook-registration.js`. Everything else here is
 *   `import type`, which is erased — in particular `@thymian/core` is not on it,
 *   so a hook file resolves with nothing installed alongside it.
 *
 * Callbacks are stored here, never invoked.
 */

/**
 * Rejects a missing or non-callable callback at the call site the user wrote.
 *
 * A one-argument `beforeEach(fn)` type-checks nowhere but runs fine in a plain
 * `.js` hook file, and unchecked it would store `target: fn, callback:
 * undefined` and then be reported as a target that matched nothing — naming a
 * target the user never wrote instead of the argument they forgot.
 *
 * A plain `TypeError` rather than a `ThymianBaseError`: keeping `@thymian/core`
 * off this module's runtime graph is what keeps `@thymian/hooks` resolvable from
 * a hook file with nothing installed alongside it.
 */
function requireCallback(
  callback: unknown,
  signature: string,
): asserts callback is HookCallback {
  if (typeof callback !== 'function') {
    throw new TypeError(
      `${signature} needs a function as its callback argument.`,
    );
  }
}

/** Shapes the generated request Sample of the targeted Transaction(s). */
export function defineSample(
  target: HookTarget,
  callback: HookCallback,
): HookRegistration {
  requireCallback(callback, 'defineSample(target, callback)');

  return registerHook({ kind: 'defineSample', target, callback });
}

/** Runs before each request of the targeted Transaction(s). */
export function beforeEach(
  target: HookTarget,
  callback: HookCallback,
): HookRegistration {
  requireCallback(callback, 'beforeEach(target, callback)');

  return registerHook({ kind: 'beforeEach', target, callback });
}

/** Runs after each response of the targeted Transaction(s). */
export function afterEach(
  target: HookTarget,
  callback: HookCallback,
): HookRegistration {
  requireCallback(callback, 'afterEach(target, callback)');

  return registerHook({ kind: 'afterEach', target, callback });
}

/**
 * Supplies credentials. Two arities, one representation:
 *
 * - `authorize(callback)` — the **global** hook, stored as `target: undefined`.
 * - `authorize(target, callback)` — **targeted**, and it wins over the global
 *   one for the Transactions it covers.
 */
export function authorize(callback: HookCallback): HookRegistration;
export function authorize(
  target: HookTarget,
  callback: HookCallback,
): HookRegistration;
export function authorize(
  ...args: [HookCallback] | [HookTarget, HookCallback]
): HookRegistration {
  // Dispatch on **arity**, never on the type of the first argument. Typing the
  // dispatch escalates scope silently in both directions: after a rename,
  // `authorize(SELECTORS.login, fn)` leaves the first argument `undefined`,
  // which is not a function — so a check on the first argument passes, the call
  // falls through to the global form, and a hook aimed at one endpoint
  // authorizes every Transaction in the API. In an authorization hook that is
  // the wrong direction to fail.
  if (args.length > 2) {
    throw authorizeArityError();
  }

  if (args.length === 1) {
    const [callback] = args;

    if (typeof callback !== 'function') {
      throw authorizeArityError();
    }

    return registerHook({ kind: 'authorize', target: undefined, callback });
  }

  const [target, callback] = args;

  if (typeof callback !== 'function') {
    throw authorizeArityError();
  }

  if (target === undefined || typeof target === 'function') {
    throw new TypeError(
      'authorize(target, callback) was called with no target. ' +
        'Check that the selector you passed is defined, ' +
        'or call authorize(callback) for the global hook.',
    );
  }

  return registerHook({ kind: 'authorize', target, callback });
}

function authorizeArityError(): TypeError {
  return new TypeError(
    'authorize(target, callback) needs a callback as its second argument. ' +
      'Call authorize(callback) for the global hook.',
  );
}

/** Runs once before the first request of the run. Carries no target. */
export function beforeAll(callback: HookCallback): HookRegistration {
  requireCallback(callback, 'beforeAll(callback)');

  return registerHook({ kind: 'beforeAll', callback });
}

/** Runs once when the run closes. Carries no target. */
export function afterAll(callback: HookCallback): HookRegistration {
  requireCallback(callback, 'afterAll(callback)');

  return registerHook({ kind: 'afterAll', callback });
}
