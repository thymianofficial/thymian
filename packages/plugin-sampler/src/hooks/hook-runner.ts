import {
  type HttpRequest,
  type HttpResponse,
  type HttpTestCaseResult,
  type HttpTestHooks,
  type Logger,
  ThymianBaseError,
  ThymianFormat,
  thymianHttpTransactionToString,
} from '@thymian/core';

import { createHookUtils } from './create-hook-utils.js';
import { FailError, SkipError } from './hook-errors.js';
import {
  type CollectedRegistration,
  type LoadUserHooksResult,
  type TransactionHooks,
} from './load-user-hooks.js';

const EMPTY_HOOKS: TransactionHooks = Object.freeze({
  defineSample: [],
  beforeEach: [],
  afterEach: [],
  authorize: [],
});

/**
 * Runs the user's hooks at the http-testing seams.
 *
 * Holds the bindings the loader produced and nothing else: an unbound
 * Transaction simply has no hooks, which is the pass-through case, so there is
 * no "not initialized" state to guard against.
 */
export class HookRunner {
  #format: ThymianFormat = new ThymianFormat();
  #byTransactionId: ReadonlyMap<string, TransactionHooks> = new Map();

  constructor(
    private readonly runRequest: (req: HttpRequest) => Promise<HttpResponse>,
    private readonly logger: Logger,
  ) {}

  /** Adopt a newly loaded format and the hooks bound against it. */
  load(format: ThymianFormat, hooks?: LoadUserHooksResult): void {
    this.#format = format;
    this.#byTransactionId = hooks?.byTransactionId ?? new Map();
  }

  private hooksFor(transactionId: string | undefined): TransactionHooks {
    if (!transactionId) {
      return EMPTY_HOOKS;
    }

    return this.#byTransactionId.get(transactionId) ?? EMPTY_HOOKS;
  }

  private utils(results: HttpTestCaseResult[]) {
    return createHookUtils(
      this.#format,
      this.runRequest,
      this,
      results,
      this.logger,
    );
  }

  async beforeEachRequest(
    hook: HttpTestHooks['beforeRequest']['arg'],
  ): Promise<HttpTestHooks['beforeRequest']['return']> {
    const { value, ctx } = hook;
    const hooks = this.hooksFor(ctx?.transactionId);
    const testResults: HttpTestCaseResult[] = [];
    const utils = this.utils(testResults);

    let result = value;

    for (const entry of hooks.beforeEach) {
      try {
        // A hook mutates in place and returns nothing; `result` is threaded so a
        // hook that does return a value is still honoured.
        const returned = await callHook(entry, [result, ctx, utils]);

        result = (returned as typeof result | undefined) ?? result;
      } catch (e) {
        const outcome = interpretHookFailure(e, 'beforeEach', entry, hook.ctx);

        if (outcome.rethrow) {
          throw outcome.rethrow;
        }

        return { result, ...outcome.report, testResults };
      }
    }

    return { result, testResults };
  }

  async afterEachResponse(
    hook: HttpTestHooks['afterResponse']['arg'],
  ): Promise<HttpTestHooks['afterResponse']['return']> {
    const { value, ctx } = hook;
    const hooks = this.hooksFor(ctx.thymianTransaction?.transactionId);
    const testResults: HttpTestCaseResult[] = [];
    const utils = this.utils(testResults);

    let result = value;

    for (const entry of hooks.afterEach) {
      try {
        const returned = await callHook(entry, [result, ctx, utils]);

        result = (returned as typeof result | undefined) ?? result;
      } catch (e) {
        const outcome = interpretHookFailure(
          e,
          'afterEach',
          entry,
          ctx.thymianTransaction,
        );

        if (outcome.rethrow) {
          throw outcome.rethrow;
        }

        return { result, ...outcome.report, testResults };
      }
    }

    return { result, testResults };
  }

  async authorize(
    hook: HttpTestHooks['authorize']['arg'],
  ): Promise<HttpTestHooks['authorize']['return']> {
    const { value, ctx } = hook;
    const hooks = this.hooksFor(ctx?.transactionId);
    // Last registration wins, which is what lets a later file override an
    // earlier one for the same Transaction.
    const entry = hooks.authorize.at(-1);

    if (!entry) {
      return { result: value };
    }

    const testResults: HttpTestCaseResult[] = [];
    const utils = this.utils(testResults);

    try {
      const returned = await callHook(entry, [value, ctx, utils]);

      return {
        result: (returned as typeof value | undefined) ?? value,
        testResults,
      };
    } catch (e) {
      const outcome = interpretHookFailure(e, 'authorize', entry, ctx);

      if (outcome.rethrow) {
        throw outcome.rethrow;
      }

      return { result: value, ...outcome.report, testResults };
    }
  }
}

async function callHook(
  entry: CollectedRegistration,
  args: readonly unknown[],
): Promise<unknown> {
  const callback = entry.registration.callback as (
    ...args: readonly unknown[]
  ) => unknown;

  return await callback(...args);
}

type HookFailure = {
  rethrow?: ThymianBaseError;
  report?: { skip: string } | { fail: string };
};

/**
 * `utils.skip` and `utils.fail` are control flow, not errors: they end this
 * transaction with a verdict. Anything else is a defect in the hook, and the
 * diagnostic names the hook's own file so the reader knows which line to open.
 */
function interpretHookFailure(
  e: unknown,
  kind: string,
  entry: CollectedRegistration,
  transaction:
    | {
        thymianReq: Parameters<typeof thymianHttpTransactionToString>[0];
        thymianRes: Parameters<typeof thymianHttpTransactionToString>[1];
      }
    | undefined,
): HookFailure {
  if (e instanceof SkipError) {
    return { report: { skip: e.message } };
  }

  if (e instanceof FailError) {
    return { report: { fail: e.message } };
  }

  const where = transaction
    ? ` for transaction ${thymianHttpTransactionToString(transaction.thymianReq, transaction.thymianRes)}`
    : '';

  return {
    rethrow: new ThymianBaseError(
      `The ${kind} hook exported as "${entry.exportName}" from "${entry.file}" threw${where}.`,
      {
        cause: e,
        name: 'HookError',
        ref: 'https://thymian.dev/references/errors/hook-error/',
      },
    ),
  };
}
