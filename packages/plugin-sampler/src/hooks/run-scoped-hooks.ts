import type { HttpTestCaseResult, Logger } from '@thymian/core';
import { ThymianBaseError } from '@thymian/core';

import type { CollectedRegistration } from './load-user-hooks.js';

/** What a `beforeAll` may hand back to be run on close. */
export type CleanupFn = () => void | Promise<void>;

/**
 * The run-scoped half of the lifecycle: `beforeAll` on a first-touch latch, and
 * `afterAll` plus any cleanups `beforeAll` returned, on close.
 *
 * "Once before the run" has no meaning until something decides when the run
 * starts, and the sampler's first observation of a run is the first request. So
 * the latch is armed by the first `beforeRequest`, and it is also what gates
 * teardown: a command that never sends a request — `sampler show`, `sampler
 * init` — must not run somebody's teardown.
 */
export class RunScopedHooks {
  #beforeAll: readonly CollectedRegistration[] = [];
  #afterAll: readonly CollectedRegistration[] = [];
  #latched = false;
  #cleanups: CleanupFn[] = [];

  constructor(private readonly logger: Logger) {}

  load(hooks: {
    beforeAll: readonly CollectedRegistration[];
    afterAll: readonly CollectedRegistration[];
  }): void {
    this.#beforeAll = hooks.beforeAll;
    this.#afterAll = hooks.afterAll;
    this.#latched = false;
    this.#cleanups = [];
  }

  /** Whether the latch has been armed, i.e. whether the run ever started. */
  get started(): boolean {
    return this.#latched;
  }

  /**
   * Arm the latch and run `beforeAll` in registration order, once.
   *
   * A throw propagates: setup that failed means the run is not in the state the
   * hooks describe, and continuing would report failures against a fixture that
   * was never built. The latch is armed **before** the callbacks run, so a
   * `beforeAll` that threw still gets its teardown — and so a second request
   * cannot re-run setup that half-succeeded.
   */
  async start(
    makeUtils: () => { utils: unknown; results: HttpTestCaseResult[] },
  ): Promise<void> {
    if (this.#latched) {
      return;
    }

    this.#latched = true;

    for (const entry of this.#beforeAll) {
      const { utils, results } = makeUtils();
      let returned: unknown;

      try {
        returned = await (
          entry.registration.callback as (u: unknown) => unknown
        )(utils);
      } catch (e) {
        this.report(results);

        throw new ThymianBaseError(
          `The beforeAll hook exported as "${entry.exportName}" from "${entry.file}" threw.`,
          {
            cause: e,
            name: 'BeforeAllHookError',
            ref: 'https://thymian.dev/references/errors/before-all-hook-error/',
          },
        );
      }

      this.report(results);

      if (typeof returned === 'function') {
        this.#cleanups.push(returned as CleanupFn);
      }
    }
  }

  /**
   * Run teardown: the cleanups `beforeAll` returned and then the `afterAll`
   * hooks, all in reverse registration order, all best-effort.
   *
   * Best-effort because `core.close` is not a place a failure can be acted on:
   * the report is already written. A teardown error is logged as a warning and
   * the remaining teardown still runs, so one leaking fixture cannot strand the
   * rest.
   *
   * Latch-gated: nothing runs if no request was ever sent.
   */
  async close(
    makeUtils: () => { utils: unknown; results: HttpTestCaseResult[] },
  ): Promise<void> {
    if (!this.#latched) {
      return;
    }

    const cleanups = this.#cleanups.splice(0).reverse();

    for (const cleanup of cleanups) {
      try {
        await cleanup();
      } catch (e) {
        this.warnTeardown('a cleanup returned by beforeAll', e);
      }
    }

    for (const entry of [...this.#afterAll].reverse()) {
      const { utils, results } = makeUtils();

      try {
        await (entry.registration.callback as (u: unknown) => unknown)(utils);
      } catch (e) {
        this.warnTeardown(
          `the afterAll hook exported as "${entry.exportName}" from "${entry.file}"`,
          e,
        );
      }

      this.report(results);
    }
  }

  private warnTeardown(what: string, e: unknown): void {
    this.logger.warn(
      `Teardown continued after ${what} threw: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  /**
   * A run-scoped hook has no test case to attach results to, so anything it
   * records through `utils` is logged instead of silently dropped.
   */
  private report(results: readonly HttpTestCaseResult[]): void {
    for (const result of results) {
      if (result.type === 'assertion-failure' || result.type === 'timeout') {
        this.logger.error(result.message);
      } else if (result.type === 'warning') {
        this.logger.warn(result.message);
      } else {
        this.logger.info(result.message);
      }
    }
  }
}
