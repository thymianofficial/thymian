import type { HttpTestCaseResult, HttpTestHooks } from '@thymian/core';
import {
  type HttpRequest,
  type HttpResponse,
  type Logger,
  ThymianBaseError,
  type ThymianFormat,
  thymianHttpTransactionToString,
} from '@thymian/core';

import type { TransactionCatalog } from '../selectors/transaction-catalog.js';
import { buildRequestKeyIndex, createHookUtils } from './create-hook-utils.js';
import { FailError, SkipError } from './hook-errors.js';
import {
  formatDiagnostic,
  hookResolutionError,
  loadUserHooks,
  type TransactionHooks,
} from './load-user-hooks.js';

export class HookRunner {
  /**
   * Which load is the current one.
   *
   * `init` awaits the loader, so two `core.format` loads can be in flight at
   * once — `Thymian.loadFormat` is a plain public method with no serialisation,
   * and a long-lived `core.workflow.test`/WS process is exactly where #614 says
   * to expect repeated loads. Measured without this counter: starting load A,
   * then load B, and letting A settle *last* left `initialized: true`,
   * `format` = B, `resolveTransactionId` built from B's catalog and `hooks`
   * bound to a transaction that exists only in A — after `init(B)` had already
   * **failed**. `invalidate()` cannot help, because the damage is done by the
   * losing load's own writes *after* its `await`.
   *
   * Every write below the `await` is gated on still being the current load.
   */
  private generation = 0;
  private initialized = false;
  private hooks: Map<string, TransactionHooks> = new Map();
  private resolveTransactionId: (key: string) => string | undefined = () =>
    undefined;
  private format!: ThymianFormat;

  constructor(
    private readonly hooksDir: string,
    private readonly runRequest: (req: HttpRequest) => Promise<HttpResponse>,
    private readonly logger: Logger,
  ) {}

  /**
   * Drops every binding from the previous format.
   *
   * `init` clears the same state on entry, which is right but not sufficient:
   * `core.format` runs two steps *before* it — `TransactionCatalog.fromThymianFormat`,
   * which throws by design on a cross-source selector collision, and
   * `readSamplesFromDirIfUsable`, which re-raises a refused path traversal. If
   * either throws, `init` is never reached and the runner keeps
   * `initialized: true` with the map built for the format *before* the one that
   * just failed to load — precisely the stale binding AC 11 and #614 exist to
   * prevent, in the long-lived `core.workflow.test` process AC 11's own
   * rationale cites.
   *
   * Exposed so the caller can invalidate before anything that can throw. It is
   * idempotent, and a runner that has been invalidated refuses to run hooks with
   * `HookRunnerNotInitialized` rather than running the wrong ones.
   */
  invalidate(): void {
    // Bumping the generation is part of invalidating: a load already in flight
    // must not install its results over a state the caller has just dropped.
    this.generation += 1;
    this.initialized = false;
    this.hooks = new Map();
    this.resolveTransactionId = () => undefined;
  }

  /**
   * (Re)binds the hook map against `format`'s freshly built selector catalog.
   *
   * There is **no init latch** (#614). Every `core.format` rebuilds, exactly as
   * `RequestSampler.init` already does — a long-lived process
   * (`core.workflow.test` over WS/IDE) otherwise keeps the map pinned to the
   * first format it ever saw. That was inert while the map was always empty; it
   * is not inert now that the map is resolved against one specific format's
   * catalog, because a stale binding is precisely the dangling-target state the
   * load-time resolution exists to prevent.
   *
   * `initialized` is set **after** the loader returns and the map is installed,
   * and cleared on entry via {@link invalidate}, so neither a loader throw nor a
   * failed re-bind can leave the runner marked initialized with a half-built
   * map. A throw *before* this method is reached is the caller's window and is
   * closed by calling {@link invalidate} there. A workspace with
   * no hooks directory still initializes: the loader returns an empty result
   * without throwing, so the three entry points below stay clean pass-throughs.
   *
   * @throws `HookResolutionError` listing **every** unresolvable hook, before
   * any request is dispatched — `core.format` precedes dispatch. The throw lives
   * here rather than in the `core.format` handler so no caller can bind a
   * half-resolved map by forgetting to check `hasErrors`; 575.10's `validate`
   * renders the same diagnostics by calling `loadUserHooks` directly.
   */
  async init(
    format: ThymianFormat,
    catalog: TransactionCatalog,
  ): Promise<void> {
    this.invalidate();

    const generation = this.generation;

    this.format = format;
    this.resolveTransactionId = buildRequestKeyIndex(catalog);

    const result = await loadUserHooks(this.hooksDir, catalog);

    for (const diagnostic of result.diagnostics) {
      if (diagnostic.severity !== 'error') {
        // Through `formatDiagnostic`, not hand-assembled: this was the one
        // rendering path the line sanitizer did not cover, so a hook file whose
        // *name* contained an ESC (legal on Linux and macOS) rewrote the
        // terminal on every debug run. It also gets `kind`, `anchor` and
        // `exportName` into the debug line, which the hand-assembled version
        // dropped.
        this.logger.debug(`Sampler hook: ${formatDiagnostic(diagnostic)}`);
      }
    }

    if (generation !== this.generation) {
      // A newer load started, or the caller invalidated, while this one was
      // awaiting. Its results are stale, so it installs nothing — including its
      // errors, which describe a format that is no longer the one being loaded.
      //
      // It **throws** rather than returning quietly. Returning made `init`
      // resolve normally with `initialized: false`, so `core.format` replied
      // *success* over a runner that would then refuse every request with
      // `HookRunnerNotInitialized`, with nothing in the log to say why. And the
      // "a newer load is behind it" assumption does not always hold: the
      // handler that bumped the generation may itself have thrown before
      // reaching its own `init`, so nobody is loading anything.
      throw new ThymianBaseError(
        'The hook runner was re-initialized while this format was loading, so this load was discarded.',
        { name: 'HookRunnerSuperseded' },
      );
    }

    if (result.hasErrors) {
      throw hookResolutionError(result.diagnostics);
    }

    // `boundHookCount`, not `perTransaction.size`: one global `authorize` binds
    // every transaction in the catalog, so the map's size counts the catalog and
    // read as "240 hooks" for one hook.
    this.logger.debug(
      `Loaded ${result.boundHookCount} hook(s) across ${result.perTransaction.size} transaction(s) from ${result.fileCount} hook file(s).`,
    );

    this.hooks = result.perTransaction;
    this.initialized = true;
  }

  async afterEachResponse(
    hook: HttpTestHooks['afterResponse']['arg'],
  ): Promise<HttpTestHooks['afterResponse']['return']> {
    if (!this.initialized) {
      throw new ThymianBaseError(
        'Cannot run hooks before @thymian/plugin-sampler is initialized.',
        {
          name: 'HookRunnerNotInitialized',
        },
      );
    }

    const { value, ctx } = hook;

    const hooks = ctx.thymianTransaction
      ? this.hooks.get(ctx.thymianTransaction.transactionId)
      : undefined;

    let result = value;

    const testResults: HttpTestCaseResult[] = [];
    const utils = createHookUtils(
      this.format,
      this.runRequest,
      this,
      this.resolveTransactionId,
      testResults,
      this.logger,
    );

    for (const afterEach of hooks?.afterEach ?? []) {
      try {
        result = await afterEach(result, ctx, utils);
      } catch (e) {
        if (e instanceof SkipError) {
          return {
            result,
            skip: e.message,
            testResults,
          };
        }
        if (e instanceof FailError) {
          return {
            result,
            fail: e.message,
            testResults,
          };
        }

        throw new ThymianBaseError(
          `Error while running afterEach hook${hook.ctx && hook.ctx.thymianTransaction ? ' for transaction: ' + thymianHttpTransactionToString(hook.ctx.thymianTransaction.thymianReq, hook.ctx.thymianTransaction.thymianRes) : ''}.`,
          {
            cause: e,
            name: 'HookError',
          },
        );
      }
    }

    return {
      result,
      testResults,
    };
  }

  async authorize(
    hook: HttpTestHooks['authorize']['arg'],
  ): Promise<HttpTestHooks['authorize']['return']> {
    if (!this.initialized) {
      throw new ThymianBaseError(
        'Cannot run hooks before @thymian/plugin-sampler is initialized.',
        {
          name: 'HookRunnerNotInitialized',
        },
      );
    }

    const { value, ctx } = hook;

    const hooks = ctx?.transactionId
      ? this.hooks.get(ctx.transactionId)
      : undefined;

    // Precedence (targeted over global) was decided at load time, so there is
    // exactly one candidate here or none.
    const authorize = hooks?.authorize;

    if (!authorize) {
      return {
        result: value,
      };
    }

    const testResults: HttpTestCaseResult[] = [];
    const utils = createHookUtils(
      this.format,
      this.runRequest,
      this,
      this.resolveTransactionId,
      testResults,
      this.logger,
    );

    try {
      const result = await authorize(value, ctx, utils);

      return {
        result,
        testResults,
      };
    } catch (e) {
      if (e instanceof SkipError) {
        return {
          result: value,
          skip: e.message,
          testResults,
        };
      }
      if (e instanceof FailError) {
        return {
          result: value,
          fail: e.message,
          testResults,
        };
      }

      throw new ThymianBaseError(
        `Error while running authorize hook${hook.ctx ? ' for transaction: ' + thymianHttpTransactionToString(hook.ctx.thymianReq, hook.ctx.thymianRes) : ''}.`,
        {
          cause: e,
          name: 'HookError',
        },
      );
    }
  }

  async beforeEachRequest(
    hook: HttpTestHooks['beforeRequest']['arg'],
  ): Promise<HttpTestHooks['beforeRequest']['return']> {
    if (!this.initialized) {
      throw new ThymianBaseError(
        'Cannot run hooks before @thymian/plugin-sampler is initialized.',
        {
          name: 'HookRunnerNotInitialized',
        },
      );
    }

    const { value, ctx } = hook;

    const hooks = ctx?.transactionId
      ? this.hooks.get(ctx.transactionId)
      : undefined;

    let result = value;

    const testResults: HttpTestCaseResult[] = [];
    const utils = createHookUtils(
      this.format,
      this.runRequest,
      this,
      this.resolveTransactionId,
      testResults,
      this.logger,
    );

    for (const beforeEach of hooks?.beforeEach ?? []) {
      try {
        result = await beforeEach(result, ctx, utils);
      } catch (e) {
        if (e instanceof SkipError) {
          return {
            result,
            skip: e.message,
            testResults,
          };
        }
        if (e instanceof FailError) {
          return {
            result,
            fail: e.message,
            testResults,
          };
        }

        throw new ThymianBaseError(
          `Error while running beforeEach hook${hook.ctx ? ' for transaction: ' + thymianHttpTransactionToString(hook.ctx.thymianReq, hook.ctx.thymianRes) : ''}.`,
          {
            cause: e,
            name: 'HookError',
          },
        );
      }
    }

    return {
      result,
      testResults,
    };
  }
}
