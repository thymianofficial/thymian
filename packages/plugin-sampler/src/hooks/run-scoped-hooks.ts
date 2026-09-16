import type { Logger } from '@thymian/core';

import type { HookUtilsFactory } from './hook-utils-factory.js';
import { invokeOrThrow, reportHookResults } from './invoke-hook.js';
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

  /**
   * The latch itself: `undefined` until the first `beforeRequest` arms it,
   * then the one setup run every caller — sequential or concurrent — awaits.
   *
   * A memoized promise rather than a boolean, because a boolean only answers
   * "has setup started", and under concurrent dispatch a second caller can
   * observe that answer before the first caller's `beforeAll` has finished (or
   * failed). Memoizing the promise itself means every caller awaits the same
   * settlement: nobody's request proceeds until setup resolves, and if it
   * rejects, every caller — however many raced in — rejects with it.
   */
  private startPromise: Promise<void> | undefined;

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
    this.startPromise = undefined;
    // `afterAll` hooks are teardown from the start; cleanups join as their
    // `beforeAll` returns them. One list, one order — so an `afterAll`
    // registered after a `beforeAll` runs *before* that `beforeAll`'s cleanup
    // when the list is reversed.
    this.teardown = hooks.afterAll.map((entry) => ({
      sequence: entry.sequence,
      describe: `the afterAll hook exported as "${entry.exportName}" from "${entry.file}"`,
      run: async () => {
        const { utils, results } = this.makeUtils(entry);

        try {
          await invokeOrThrow('afterAll', entry, [utils]);
        } finally {
          reportHookResults(this.logger, results);
        }
      },
    }));
  }

  /**
   * Arm the latch and run `beforeAll` in registration order, once — memoized as
   * a promise, so every caller (sequential or concurrent) awaits the very same
   * setup run instead of each independently checking whether one already
   * started.
   *
   * The assignment happens synchronously, before {@link runBeforeAll}'s body
   * gets its first chance to `await` anything: a second, concurrent caller
   * reaching this method — however soon after the first — always finds
   * {@link startPromise} already set and receives *that* promise rather than
   * starting a second run. That is what makes concurrent dispatch safe: no
   * caller's request proceeds until this promise settles, and if it rejects,
   * every caller who awaited it rejects with it — none of their requests were
   * ever sent.
   *
   * The latch is armed **before** the callbacks run, so a `beforeAll` that
   * threw still gets its teardown — and so a later request cannot re-run setup
   * that already failed.
   */
  start(): Promise<void> {
    this.startPromise ??= this.runBeforeAll();

    return this.startPromise;
  }

  /**
   * The setup run itself. Failure goes through the same attribution wrapper
   * every other hook kind does — there is no `beforeAll`-specific copy of it
   * here any more — and propagates out of the memoized promise so every
   * awaiter sees it.
   */
  private async runBeforeAll(): Promise<void> {
    for (const entry of this.beforeAll) {
      const { utils, results } = this.makeUtils(entry);
      let returned: unknown;

      try {
        returned = await invokeOrThrow('beforeAll', entry, [utils]);
      } finally {
        reportHookResults(this.logger, results);
      }

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
    if (!this.startPromise) {
      return;
    }

    // Setup may still be in flight, or may have rejected, by the time close
    // runs. Either way, teardown waits for it to settle first: racing ahead
    // would read {@link teardown} while `runBeforeAll` is still pushing
    // cleanups onto it, and a rejection here is not this method's to report —
    // whoever awaited `start()` already saw it. Best-effort teardown still
    // runs for whatever succeeded before the rejection.
    await this.startPromise.catch(() => {
      // Ignored here: whoever awaited `start()` already saw this rejection.
    });

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
