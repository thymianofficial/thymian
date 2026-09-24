import {
  type HttpTestCaseResult,
  type Logger,
  ThymianBaseError,
} from '@thymian/core';

import {
  FailError,
  SkipError,
  UndeclaredResponseError,
} from './hook-errors.js';
import type { HookKind } from './hook-registration.js';
import type { CollectedRegistration } from './load-user-hooks.js';

/**
 * Calls one user callback with the arguments its kind is given.
 *
 * The cast lives here and nowhere else: a registration's `callback` is stored as
 * an opaque function because each kind's precise signature is the runner's
 * contract and the generated `.d.ts` is what types it for the author.
 *
 * The return value is discarded on purpose. A hook's contract is to mutate in
 * place and return nothing, and honouring a return corrupts the value for the
 * most ordinary shorthand there is: `(r) => (r.headers.x = 'y')` evaluates to
 * `'y'`.
 */
export async function invokeHook(
  entry: CollectedRegistration,
  args: readonly unknown[],
): Promise<unknown> {
  const callback = entry.registration.callback as (
    ...args: readonly unknown[]
  ) => unknown;

  return await callback(...args);
}

/**
 * Where a hook's `utils` results go when there is no test case to attach them
 * to — a run-scoped hook, or a `defineSample` that runs before any request
 * exists. Logging them beats dropping them silently.
 */
export function reportHookResults(
  logger: Logger,
  results: readonly HttpTestCaseResult[],
): void {
  for (const result of results) {
    if (result.type === 'assertion-failure' || result.type === 'timeout') {
      logger.error(result.message);
    } else if (
      result.type === 'warning' ||
      // A nested request has no test case of its own, so these are the only
      // place its failure is ever said out loud. At `info` a seed answered
      // with a declared-but-different status was invisible at the default
      // level, while every transaction that depended on it turned up
      // `skipped` with nothing naming the cause — the reader saw the
      // consequence and not the reason.
      result.type === 'invalid-transaction' ||
      result.type === 'execution-error'
    ) {
      logger.warn(result.message);
    } else {
      logger.info(result.message);
    }
  }
}

/**
 * Names the hook a sampler diagnostic came out of, without burying the
 * diagnostic.
 *
 * A cycle error's value is the chain it prints and a setter-misuse error's is
 * the sentence explaining the misuse — both live in `suggestions`, so wrapping
 * the error in a "hook X threw" envelope would throw away the part worth
 * reading. The location joins the suggestions instead, at the front, where it
 * answers "which line do I open" before the diagnostic answers "why".
 */
export function attributeToHook(
  error: ThymianBaseError,
  kind: string,
  entry: CollectedRegistration,
): ThymianBaseError {
  return new ThymianBaseError(error.message, {
    ...error.options,
    // After the spread, never before it. An `error` closes the run
    // (`thymian.ts`), which is the mechanism ADR-0023 §2 names and the sentence
    // above promises to prevent — and every sampler-raised error that reaches
    // here defaults to `error` because none of them sets a severity of its own:
    // `UnknownSelectorError` and `MalformedSelectorError` from `utils.request`,
    // `RequestCycleError`, a seed's `RequestSerializationError`,
    // `NoRequestToShapeError`, `NoNestedRequestError`. A typo in a seed's
    // selector is the most ordinary hook fault there is, and it ended the run.
    severity: 'warn',
    suggestions: [
      `Raised by the ${kind} hook exported as "${entry.exportName}" from "${entry.file}".`,
      ...(error.options.suggestions ?? []),
    ],
    cause: error.cause,
  });
}

/** What interpreting a hook's failure decided should happen next. */
export type HookFailure = {
  rethrow?: ThymianBaseError;
  report?: { skip: string } | { fail: string };
};

/**
 * The kinds that run against one Transaction, and so have somewhere for a
 * `utils.skip`/`utils.fail` verdict — or an unhandled off-spec seed answer —
 * to land. `defineSample` runs before any request exists and `beforeAll`/
 * `afterAll` run once for the whole run rather than per Transaction, so a
 * control-flow throw from one of those has no Transaction to apply to and is
 * treated like any other defect in the hook.
 */
const TRANSACTION_SCOPED_KINDS: ReadonlySet<HookKind> = new Set([
  'beforeEach',
  'afterEach',
  'authorize',
]);

/**
 * The one interpretation every hook kind's failure goes through:
 * `utils.skip`/`utils.fail` and an unhandled off-spec seed answer become a
 * verdict for the kinds that have a Transaction to apply it to; a diagnostic
 * the sampler itself raised keeps its own message and suggestions with the
 * hook's location added; anything else is a defect in the hook and gets the
 * envelope that names it.
 *
 * Every diagnostic that leaves here carries `severity: 'warn'`, and that is
 * load-bearing rather than a judgement about how bad it is. An `error`-severity
 * event closes the whole run through `Thymian.run`'s error subscription, which
 * is precisely the behaviour the outcome model replaces: one broken hook used
 * to end the command and hide every transaction after it.
 */
export function interpretHookFailure(
  e: unknown,
  kind: HookKind,
  entry: CollectedRegistration,
): HookFailure {
  const controlFlow = TRANSACTION_SCOPED_KINDS.has(kind);

  if (controlFlow && e instanceof SkipError) {
    return { report: { skip: e.message } };
  }

  if (controlFlow && e instanceof FailError) {
    return { report: { fail: e.message } };
  }

  // An off-spec seed answer that nobody caught. Reacting to it is opt-in, so
  // letting it escape is a legitimate way to write a hook: the transaction
  // cannot be executed as described, which is a skip and not a defect, and the
  // message already names the seed and what it was answered with.
  if (controlFlow && e instanceof UndeclaredResponseError) {
    return { report: { skip: e.message } };
  }

  if (e instanceof ThymianBaseError) {
    return { rethrow: attributeToHook(e, kind, entry) };
  }

  return {
    rethrow: new ThymianBaseError(
      // Deliberately without the Transaction: every surface that prints one
      // already names it (ADR-0022), and repeating it under a header that says
      // it is the noise this model removes. What only this sentence knows is
      // which export in which file to open.
      `The ${kind} hook exported as "${entry.exportName}" from "${entry.file}" threw.`,
      {
        cause: e,
        name: 'HookError',
        ref: 'https://thymian.dev/references/errors/hook-error/',
        severity: 'warn',
      },
    ),
  };
}

/**
 * Runs one hook through the shared attribution pipeline and always throws on
 * failure — for `defineSample`, `beforeAll` and `afterAll`, which have no
 * Transaction to report a `skip`/`fail` verdict against. Callable only with a
 * kind outside {@link TRANSACTION_SCOPED_KINDS}, which is what guarantees
 * {@link interpretHookFailure} always hands back a `rethrow` here and never a
 * `report` with nowhere to go.
 *
 * The raw return value is handed back rather than discarded: `beforeAll` is
 * the one kind whose return is not mutate-and-ignore — a returned function is
 * a cleanup to run at teardown.
 */
export async function invokeOrThrow(
  kind: Exclude<HookKind, 'beforeEach' | 'afterEach' | 'authorize'>,
  entry: CollectedRegistration,
  args: readonly unknown[],
): Promise<unknown> {
  try {
    return await invokeHook(entry, args);
  } catch (e) {
    const { rethrow } = interpretHookFailure(e, kind, entry);

    if (!rethrow) {
      // Unreachable: `kind`'s type excludes every member of
      // TRANSACTION_SCOPED_KINDS, and that is the only set
      // interpretHookFailure ever produces a `report` — never a `rethrow` —
      // for.
      throw new Error(
        `invariant violated: interpretHookFailure produced no rethrow for hook kind "${kind}"`,
      );
    }

    throw rethrow;
  }
}
