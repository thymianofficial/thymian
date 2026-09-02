import { randomBytes } from 'node:crypto';

import { type HttpTestCaseResult, ThymianBaseError } from '@thymian/core';

import { FailError, SkipError } from './hook-errors.js';
import type { Endpoints, HookUtils } from './hook-utils.js';

const charset =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * The `utils` object every hook is handed.
 *
 * `results` is the array a hook's assertions and messages land in; the caller
 * owns it and decides where it goes — onto a test case, or into the log when
 * the hook has no test case (run-scoped hooks, `defineSample`).
 */
export function createHookUtils<E extends Endpoints>(
  results: HttpTestCaseResult[],
): HookUtils<E> {
  return {
    assertionFailure(message: string, details = {}): void {
      results.push({
        type: 'assertion-failure',
        message,
        ...details,
      });
    },
    assertionSuccess(message, assertion: string): void {
      results.push({
        type: 'assertion-success',
        message,
        assertion,
      });
    },
    info(message: string): void {
      results.push({
        type: 'info',
        message,
      });
    },
    timeout(message, durationMs: number): void {
      results.push({
        type: 'timeout',
        message,
        durationMs,
      });
    },
    warn(message: string, details?: string): void {
      results.push({
        type: 'warning',
        message,
        details,
      });
    },
    randomString(length = 10): string {
      const bytes = randomBytes(length);
      const result = new Array(length);

      for (let i = 0; i < length; i++) {
        result[i] = charset[bytes[i]! % charset.length];
      }

      return result.join('');
    },
    /**
     * Cross-endpoint request.
     *
     * The v1 implementation resolved its target through an index written into
     * the samples tree, keyed by `"METHOD url"`. That tree is gone, and its
     * replacement resolves a Selector through the transaction catalog — the same
     * strings the committed types are keyed by. Until that lands, a
     * cross-endpoint request says what is missing rather than failing as a
     * lookup miss in a key language that no longer exists.
     */
    async request<R extends keyof E>(
      url: R,
      args: E[R]['req'],
      options: {
        runHooks?: boolean;
        authorize?: boolean;
      } = {},
    ): Promise<E[R]['res']> {
      void args;
      void options;

      throw new ThymianBaseError(
        `Cannot run a cross-endpoint request for "${String(url)}" yet.`,
        {
          name: 'CrossEndpointRequestUnavailableError',
          suggestions: [
            'Selector-keyed `utils.request` arrives with the typed utils surface.',
          ],
        },
      );
    },
    fail(msg: string): never {
      throw new FailError(msg);
    },
    skip(msg: string): never {
      throw new SkipError(msg);
    },
  };
}
