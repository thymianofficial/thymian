import type { HttpTestCaseResult, Logger } from '@thymian/core';

import type { CollectedRegistration } from './load-user-hooks.js';

/**
 * Calls one user callback with the arguments its kind is given.
 *
 * The cast lives here and nowhere else: a registration's `callback` is stored as
 * an opaque function because each kind's precise signature is the runner's
 * contract and the generated `.d.ts` is what types it for the author.
 *
 * The return value is discarded on purpose. A hook's contract is to mutate in
 * place and return nothing, and honouring a return corrupts the value for the
 * most ordinary shorthand there is: `(r) => (r.headers.x = 'y')` evaluates to
 * `'y'`.
 */
export async function invokeHook(
  entry: CollectedRegistration,
  args: readonly unknown[],
): Promise<unknown> {
  const callback = entry.registration.callback as (
    ...args: readonly unknown[]
  ) => unknown;

  return await callback(...args);
}

/**
 * Where a hook's `utils` results go when there is no test case to attach them
 * to — a run-scoped hook, or a `defineSample` that runs before any request
 * exists. Logging them beats dropping them silently.
 */
export function reportHookResults(
  logger: Logger,
  results: readonly HttpTestCaseResult[],
): void {
  for (const result of results) {
    if (result.type === 'assertion-failure' || result.type === 'timeout') {
      logger.error(result.message);
    } else if (result.type === 'warning') {
      logger.warn(result.message);
    } else {
      logger.info(result.message);
    }
  }
}
