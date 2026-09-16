import type { HttpTestCaseResult } from '@thymian/core';

import type { Endpoints, HookUtils } from './hook-utils.js';
import type { CollectedRegistration } from './load-user-hooks.js';

/**
 * Makes one `utils` object and the array its results land in, for one
 * registration.
 *
 * A factory rather than a single object: results belong to one hook call, so
 * each call needs its own array, and the caller is the only thing that knows
 * where those results should end up. It takes the registration itself —
 * rather than being called bare — so a run-scoped hook's file helpers resolve
 * against *its own* file's directory instead of the process's working
 * directory.
 */
export type HookUtilsFactory = (entry: CollectedRegistration) => {
  utils: HookUtils<Endpoints>;
  results: HttpTestCaseResult[];
};
