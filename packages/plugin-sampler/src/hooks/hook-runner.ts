import {
  type HttpRequest,
  type HttpRequestTemplate,
  type HttpResponse,
  type HttpTestCaseResult,
  type HttpTestHooks,
  type Logger,
  serializeRequest,
  ThymianBaseError,
  ThymianFormat,
  type ThymianHttpTransaction,
  thymianHttpTransactionToString,
} from '@thymian/core';

import type { Selector } from '../selectors/selector.js';
import { TransactionCatalog } from '../selectors/transaction-catalog.js';
import {
  createHookUtils,
  type HookCallContext,
  parseResponseBody,
} from './create-hook-utils.js';
import { FailError, SkipError } from './hook-errors.js';
import type { HookKind } from './hook-registration.js';
import type {
  EndpointRequest,
  EndpointResponse,
  RequestOptions,
} from './hook-utils.js';
import type { HookUtilsFactory } from './hook-utils-factory.js';
import {
  attributeToHook,
  invokeHook,
  reportHookResults,
} from './invoke-hook.js';
import {
  type CollectedRegistration,
  type LoadUserHooksResult,
  type TransactionHooks,
} from './load-user-hooks.js';
import {
  isOnChain,
  requestCycleError,
  type SelectorChain,
} from './nested-request.js';
import { RunScopedHooks } from './run-scoped-hooks.js';

const EMPTY_HOOKS: TransactionHooks = Object.freeze({
  defineSample: [],
  beforeEach: [],
  afterEach: [],
  authorize: [],
});

/** What the runner needs from the rest of the plugin to send a request. */
export type HookRunnerPorts = {
  /** The freshly generated request for one transaction. */
  sampleRequest: (
    transaction: ThymianHttpTransaction,
  ) => Promise<HttpRequestTemplate>;
  /** Puts a serialized request on the wire. */
  dispatch: (request: HttpRequest) => Promise<HttpResponse>;
};

/**
 * Runs the user's hooks at the http-testing seams.
 *
 * Holds the bindings the loader produced and nothing else: an unbound
 * Transaction simply has no hooks, which is the pass-through case, so there is
 * no "not initialized" state to guard against.
 */
export class HookRunner {
  private format: ThymianFormat = new ThymianFormat();
  private catalog: TransactionCatalog = TransactionCatalog.fromThymianFormat(
    new ThymianFormat(),
  );
  private byTransactionId: ReadonlyMap<string, TransactionHooks> = new Map();
  private globalAuthorize: readonly CollectedRegistration[] = [];
  private readonly runScoped: RunScopedHooks;

  constructor(
    private readonly logger: Logger,
    private readonly ports: HookRunnerPorts,
  ) {
    this.runScoped = new RunScopedHooks(logger, this.utilsFactory);
  }

  /** Adopt a newly loaded format and the hooks bound against it. */
  load(
    format: ThymianFormat,
    catalog: TransactionCatalog,
    hooks?: LoadUserHooksResult,
  ): void {
    this.format = format;
    this.catalog = catalog;
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

  /**
   * The `utils` a hook with no request to shape gets: the run-scoped pair. A
   * nested request is available, because a `beforeAll` seeding the API is the
   * reason `utils.request` exists.
   */
  private readonly utilsFactory: HookUtilsFactory = () => {
    const results: HttpTestCaseResult[] = [];

    return {
      utils: createHookUtils(
        this.callContext({ dir: process.cwd(), results, chain: [] }),
      ),
      results,
    };
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

    const results: HttpTestCaseResult[] = [];

    await invokeHook(entry, [
      draft,
      createHookUtils(
        // No nested request: a `defineSample` hook runs before any request
        // exists, so there is no pipeline for one to run through.
        { dir: entry.dir, request: draft, results },
      ),
    ]);

    reportHookResults(this.logger, results);
  };

  private hooksFor(transactionId: string | undefined): TransactionHooks {
    if (!transactionId) {
      return EMPTY_HOOKS;
    }

    return this.byTransactionId.get(transactionId) ?? EMPTY_HOOKS;
  }

  private callContext(input: {
    dir: string;
    request?: HttpRequestTemplate;
    results: HttpTestCaseResult[];
    chain: SelectorChain;
  }): HookCallContext {
    return {
      dir: input.dir,
      request: input.request,
      results: input.results,
      requestOther: async (selector, args, options) =>
        await this.runNested(selector, args, options, input.chain),
    };
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
      value,
      this.chainFor(ctx),
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
      ctx.requestTemplate,
      this.chainFor(ctx.thymianTransaction),
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
      value,
      this.chainFor(ctx),
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
   * The chain a hook of `transaction` runs with: the Transaction's own Selector,
   * so a hook that seeds itself is caught on the first step.
   */
  private chainFor(
    transaction: ThymianHttpTransaction | undefined,
  ): SelectorChain {
    if (!transaction) {
      return [];
    }

    const selector = this.catalog.selectorFor(transaction.transactionId);

    return selector ? [selector] : [];
  }

  /**
   * Run a kind's hooks in order over one value, and translate whatever comes
   * back into the shape the http-testing seam expects.
   *
   * Every hook **mutates `value` in place**; the callback's return value is
   * deliberately discarded (see {@link invokeHook}).
   */
  private async compose<T>(
    kind: HookKind,
    entries: readonly CollectedRegistration[],
    value: T,
    ctx: unknown,
    transaction: TransactionForDiagnostic,
    request: HttpRequestTemplate | undefined,
    chain: SelectorChain,
  ): Promise<{
    result: T;
    testResults: HttpTestCaseResult[];
    skip?: string;
    fail?: string;
  }> {
    const testResults: HttpTestCaseResult[] = [];

    for (const entry of entries) {
      const utils = createHookUtils(
        this.callContext({
          dir: entry.dir,
          request,
          results: testResults,
          chain,
        }),
      );

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

  /**
   * Send a request to another Transaction, addressed by its Selector.
   *
   * By default the nested request runs the target's own
   * `beforeEach → authorize → afterEach` pipeline, so seeding behaves like the
   * real run rather than like a second, quieter client. `runHooks: false` sends
   * the generated request as-is, which is also the way out of a cycle.
   */
  private async runNested(
    selector: Selector,
    args: EndpointRequest,
    options: RequestOptions,
    chain: SelectorChain,
  ): Promise<EndpointResponse> {
    const runHooks = options.runHooks ?? true;

    // Only a call that would run the target's own pipeline can recurse, so
    // `runHooks: false` is the documented way out of a cycle. The chain is
    // still extended below, because an authorize hook may run either way and
    // could itself recurse.
    if (runHooks && isOnChain(chain, selector)) {
      throw requestCycleError(chain, selector);
    }

    const transaction = this.catalog.resolve(selector);
    const nested: SelectorChain = [...chain, selector];
    const template = applyArgs(
      await this.ports.sampleRequest(transaction),
      args,
    );

    if (options.authorize !== undefined) {
      template.authorize = options.authorize;
    }

    const results: HttpTestCaseResult[] = [];

    if (runHooks) {
      const before = await this.compose(
        'beforeEach',
        this.hooksFor(transaction.transactionId).beforeEach,
        template,
        transaction,
        transaction,
        template,
        nested,
      );

      results.push(...before.testResults);
    }

    const authorizeHook = this.authorizeFor(transaction.transactionId);

    if (template.authorize && authorizeHook) {
      const authorized = await this.compose(
        'authorize',
        [authorizeHook],
        template,
        transaction,
        transaction,
        template,
        nested,
      );

      results.push(...authorized.testResults);
    }

    const request = serializeRequest({
      requestTemplate: template,
      source: transaction,
    });
    const response = await this.ports.dispatch(request);

    if (runHooks) {
      const after = await this.compose(
        'afterEach',
        this.hooksFor(transaction.transactionId).afterEach,
        response,
        { request, requestTemplate: template, thymianTransaction: transaction },
        transaction,
        template,
        nested,
      );

      results.push(...after.testResults);
    }

    // A nested request has no test case of its own; what its hooks recorded is
    // logged rather than dropped.
    reportHookResults(this.logger, results);

    return {
      body: parseResponseBody(response),
      headers: response.headers,
      statusCode: response.statusCode,
    };
  }
}

/** Overlays a caller's arguments onto a generated request. */
function applyArgs(
  template: HttpRequestTemplate,
  args: EndpointRequest,
): HttpRequestTemplate {
  return {
    ...template,
    headers: { ...template.headers, ...args.headers },
    query: { ...template.query, ...args.query },
    cookies: { ...template.cookies, ...args.cookies },
    pathParameters: { ...template.pathParameters, ...args.path },
    ...('body' in args ? { body: args.body } : {}),
  };
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

  if (e instanceof ThymianBaseError) {
    // A diagnostic the sampler itself raised — a cycle, an unknown selector, a
    // setter with no request — already says what went wrong better than a
    // wrapper would, and its suggestions are the part worth reading. Keep it,
    // and add where it came from.
    return { rethrow: attributeToHook(e, kind, entry) };
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
