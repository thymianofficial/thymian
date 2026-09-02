import type { HttpTestCaseResult } from '@thymian/core';

import type { Endpoints, HookUtils } from './hook-utils.js';

/**
 * Makes one `utils` object and the array its results land in.
 *
 * A factory rather than a single object: results belong to one hook call, so
 * each call needs its own array, and the caller is the only thing that knows
 * where those results should end up.
 */
export type HookUtilsFactory = () => {
  utils: HookUtils<Endpoints>;
  results: HttpTestCaseResult[];
};
