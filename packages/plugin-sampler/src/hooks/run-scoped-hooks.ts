import { type Logger, ThymianBaseError } from '@thymian/core';

import type { HookUtilsFactory } from './hook-utils-factory.js';
import {
  attributeToHook,
  invokeHook,
  reportHookResults,
} from './invoke-hook.js';
import type { CollectedRegistration } from './load-user-hooks.js';

/** What a `beforeAll` may hand back to be run on close. */
type CleanupFn = () => void | Promise<void>;

/** One thing to run at teardown, and where it sits in the run's order. */
type TeardownItem = {
  sequence: number;
  run: () => Promise<void>;
  describe: string;
};

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
  private beforeAll: readonly CollectedRegistration[] = [];
  private teardown: TeardownItem[] = [];
  private latched = false;

  constructor(
    private readonly logger: Logger,
    private readonly makeUtils: HookUtilsFactory,
  ) {}

  /**
   * Adopt newly loaded hooks.
   *
   * A reload drops teardown that the previous load's `beforeAll` registered. It
   * has to: those closures were built against a format that is no longer
   * loaded, and running them later would tear down a fixture whose description
   * has changed underneath. A reload mid-run is not a shape the CLI produces.
   */
  load(hooks: {
    beforeAll: readonly CollectedRegistration[];
    afterAll: readonly CollectedRegistration[];
  }): void {
    this.beforeAll = hooks.beforeAll;
    this.latched = false;
    // `afterAll` hooks are teardown from the start; cleanups join as their
    // `beforeAll` returns them. One list, one order — so an `afterAll`
    // registered after a `beforeAll` runs *before* that `beforeAll`'s cleanup
    // when the list is reversed.
    this.teardown = hooks.afterAll.map((entry) => ({
      sequence: entry.sequence,
      describe: `the afterAll hook exported as "${entry.exportName}" from "${entry.file}"`,
      run: async () => {
        const { utils, results } = this.makeUtils();

        await invokeHook(entry, [utils]);

        reportHookResults(this.logger, results);
      },
    }));
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
  async start(): Promise<void> {
    if (this.latched) {
      return;
    }

    this.latched = true;

    for (const entry of this.beforeAll) {
      const { utils, results } = this.makeUtils();
      let returned: unknown;

      try {
        returned = await invokeHook(entry, [utils]);
      } catch (e) {
        reportHookResults(this.logger, results);

        // A diagnostic the sampler raised keeps its own message and
        // suggestions, with the hook's location added; anything else is a
        // defect in the hook and gets the envelope that names it.
        throw e instanceof ThymianBaseError
          ? attributeToHook(e, 'beforeAll', entry)
          : new ThymianBaseError(
              `The beforeAll hook exported as "${entry.exportName}" from "${entry.file}" threw.`,
              {
                cause: e,
                name: 'BeforeAllHookError',
                ref: 'https://thymian.dev/references/errors/before-all-hook-error/',
              },
            );
      }

      reportHookResults(this.logger, results);

      if (typeof returned === 'function') {
        const cleanup = returned as CleanupFn;

        this.teardown.push({
          sequence: entry.sequence,
          describe: `the cleanup returned by the beforeAll hook exported as "${entry.exportName}" from "${entry.file}"`,
          run: async () => {
            await cleanup();
          },
        });
      }
    }
  }

  /**
   * Run teardown in reverse order of the run: one list holding both the
   * cleanups `beforeAll` returned and the `afterAll` hooks, reversed.
   *
   * Best-effort, because `core.close` is not a place a failure can be acted on —
   * the report is already written. A teardown error is logged as a warning and
   * the rest still runs, so one leaking fixture cannot strand the others.
   *
   * Latch-gated: nothing runs if no request was ever sent.
   */
  async close(): Promise<void> {
    if (!this.latched) {
      return;
    }

    const items = this.teardown
      .splice(0)
      // A stable sort, so two items registered in the same position keep the
      // order they joined the list in.
      .map((item, index) => ({ item, index }))
      .sort((a, b) => b.item.sequence - a.item.sequence || b.index - a.index)
      .map(({ item }) => item);

    for (const item of items) {
      try {
        await item.run();
      } catch (e) {
        this.logger.warn(
          `Teardown continued after ${item.describe} threw: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }
}
