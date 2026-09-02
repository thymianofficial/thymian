import {
  type HttpRequest,
  type HttpRequestTemplate,
  type HttpResponse,
  type HttpTestCaseResult,
  type HttpTestHooks,
  type Logger,
  ThymianBaseError,
  ThymianFormat,
  type ThymianHttpTransaction,
  thymianHttpTransactionToString,
} from '@thymian/core';

import { createHookUtils } from './create-hook-utils.js';
import { FailError, SkipError } from './hook-errors.js';
import type { HookKind } from './hook-registration.js';
import type { HookUtilsFactory } from './hook-utils-factory.js';
import { invokeHook, reportHookResults } from './invoke-hook.js';
import {
  type CollectedRegistration,
  type LoadUserHooksResult,
  type TransactionHooks,
} from './load-user-hooks.js';
import { RunScopedHooks } from './run-scoped-hooks.js';

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
  private format: ThymianFormat = new ThymianFormat();
  private byTransactionId: ReadonlyMap<string, TransactionHooks> = new Map();
  private globalAuthorize: readonly CollectedRegistration[] = [];
  private readonly runScoped: RunScopedHooks;

  constructor(private readonly logger: Logger) {
    this.runScoped = new RunScopedHooks(logger, this.utilsFactory);
  }

  /**
   * The `utils` a hook with no test case to attach results to gets: run-scoped
   * hooks, and `defineSample`. Their results are logged by whoever called them.
   */
  private readonly utilsFactory: HookUtilsFactory = () => {
    const results: HttpTestCaseResult[] = [];

    return { utils: this.utils(results), results };
  };

  /**
   * Shape one request draft with its Transaction's `defineSample` hook, if it
   * has one. This is what `RequestSampler` calls at generation time; the sampler
   * itself knows nothing about hooks.
   */
  readonly shapeSample = async (
    draft: HttpRequestTemplate,
    transactionId: string,
  ): Promise<void> => {
    const entry = this.hooksFor(transactionId).defineSample[0];

    if (!entry) {
      return;
    }

    const { utils, results } = this.utilsFactory();

    await invokeHook(entry, [draft, utils]);

    reportHookResults(this.logger, results);
  };

  /** Adopt a newly loaded format and the hooks bound against it. */
  load(format: ThymianFormat, hooks?: LoadUserHooksResult): void {
    this.format = format;
    this.byTransactionId = hooks?.byTransactionId ?? new Map();
    this.globalAuthorize = hooks?.globalAuthorize ?? [];
    this.runScoped.load(hooks?.runScoped ?? { beforeAll: [], afterAll: [] });
  }

  /**
   * Teardown, on `core.close`. A no-op when no request was ever sent, so a
   * non-test command never runs somebody's teardown.
   */
  async close(): Promise<void> {
    await this.runScoped.close();
  }

  private hooksFor(transactionId: string | undefined): TransactionHooks {
    if (!transactionId) {
      return EMPTY_HOOKS;
    }

    return this.byTransactionId.get(transactionId) ?? EMPTY_HOOKS;
  }

  private utils(results: HttpTestCaseResult[]) {
    return createHookUtils(results);
  }

  async beforeEachRequest(
    hook: HttpTestHooks['beforeRequest']['arg'],
  ): Promise<HttpTestHooks['beforeRequest']['return']> {
    const { value, ctx } = hook;

    // The first request is what "before the run" means to the sampler, so the
    // latch is armed here — ahead of this transaction's own beforeEach hooks.
    await this.runScoped.start();

    return await this.compose(
      'beforeEach',
      this.hooksFor(ctx?.transactionId).beforeEach,
      value,
      ctx,
      ctx,
    );
  }

  async afterEachResponse(
    hook: HttpTestHooks['afterResponse']['arg'],
  ): Promise<HttpTestHooks['afterResponse']['return']> {
    const { value, ctx } = hook;

    return await this.compose(
      'afterEach',
      this.hooksFor(ctx.thymianTransaction?.transactionId).afterEach,
      value,
      ctx,
      ctx.thymianTransaction,
    );
  }

  async authorize(
    hook: HttpTestHooks['authorize']['arg'],
  ): Promise<HttpTestHooks['authorize']['return']> {
    const { value, ctx } = hook;
    const entry = this.authorizeFor(ctx?.transactionId);

    return await this.compose(
      'authorize',
      entry ? [entry] : [],
      value,
      ctx,
      ctx,
    );
  }

  /**
   * Which authorize hook supplies this Transaction's credentials.
   *
   * A targeted hook wins over the global one for the Transactions it covers, and
   * within each tier the last registration wins, so a later file can override an
   * earlier one. Exactly one hook runs: authorization is "who am I", and
   * composing two answers would mean two sets of credentials on one request.
   *
   * Whether it runs at all is not decided here — core runs this seam only when
   * the run option and the request's own `authorize` flag agree — so a
   * registered hook is necessary but not sufficient, which is what makes
   * "force on" need both.
   */
  private authorizeFor(
    transactionId: string | undefined,
  ): CollectedRegistration | undefined {
    return (
      this.hooksFor(transactionId).authorize.at(-1) ??
      this.globalAuthorize.at(-1)
    );
  }

  /**
   * Run a kind's hooks in order over one value, and translate whatever comes
   * back into the shape the http-testing seam expects.
   *
   * Every hook **mutates `value` in place**; the callback's return value is
   * deliberately discarded. Honouring a return instead corrupts the value for
   * the most ordinary shorthand there is — `(r) => (r.headers.x = 'y')`
   * evaluates to `'y'`, which would replace the whole request with that string.
   */
  private async compose<T>(
    kind: HookKind,
    entries: readonly CollectedRegistration[],
    value: T,
    ctx: unknown,
    transaction: TransactionForDiagnostic,
  ): Promise<{
    result: T;
    testResults: HttpTestCaseResult[];
    skip?: string;
    fail?: string;
  }> {
    const testResults: HttpTestCaseResult[] = [];
    const utils = this.utils(testResults);

    for (const entry of entries) {
      try {
        await invokeHook(entry, [value, ctx, utils]);
      } catch (e) {
        const outcome = interpretHookFailure(e, kind, entry, transaction);

        if (outcome.rethrow) {
          throw outcome.rethrow;
        }

        return { result: value, ...outcome.report, testResults };
      }
    }

    return { result: value, testResults };
  }
}

/** What a diagnostic needs to name the transaction a hook was running for. */
type TransactionForDiagnostic =
  Pick<ThymianHttpTransaction, 'thymianReq' | 'thymianRes'> | undefined;

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
  kind: HookKind,
  entry: CollectedRegistration,
  transaction: TransactionForDiagnostic,
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
