import {
  errorSuggestions,
  type HttpTestCase,
  type HttpTestCaseResult,
  isRequestSerializationError,
  type ThymianHttpTransaction,
  thymianHttpTransactionToString,
} from '@thymian/core';

import type { Selector } from '../selectors/selector.js';

/**
 * The record `sampler check` renders and `--json` emits.
 *
 * Beside the commands rather than among them: everything under
 * `cli/commands/` is scanned by oclif as a command, and a module that is not
 * one is reported as a missing command on every single run.
 */

/**
 * What one Transaction earned. Exactly one, always — a run that ends leaves no
 * Transaction unaccounted for.
 *
 * - `passed` — executed, and answered as described.
 * - `failed` — executed, and the response was invalid.
 * - `skipped` — could not be executed *as described*: its Seed was answered
 *   differently, or the description does not supply a value the request needs.
 * - `errored` — the attempt itself broke.
 *
 * The line between `skipped` and `failed` is the one worth holding. A
 * transaction whose precondition never happened has told us nothing about the
 * API, and rendering it as a failure is what turned one upstream problem into a
 * wall of unrelated red.
 */
export type Outcome = 'passed' | 'failed' | 'skipped' | 'errored';

/** One Transaction's result — and the documented shape `--json` emits. */
export type CheckedTransaction = {
  selector: Selector;
  outcome: Outcome;
  expectedStatus: number;
  actualStatus?: number;
  /** Why it is not `passed`. Printed once, under the header. */
  reason?: string;
  /** The Seed whose own answer explains this outcome, when there is one. */
  causedBy?: Selector;
  /** Remediation, as whoever raised the problem wrote it. */
  details: string[];
};

export type CheckSummary = {
  passed: number;
  failed: number;
  skipped: number;
  errored: number;
  total: number;
};

/**
 * What `sampler check --json` prints: one document, the whole run.
 *
 * The stable machine contract. `details` is deliberately not part of it — it is
 * remediation prose for a reader, and `reason` already names the cause an agent
 * has to act on.
 */
export type CheckReport = {
  summary: CheckSummary;
  transactions: Array<Omit<CheckedTransaction, 'details'>>;
};

export function reportOf(checked: readonly CheckedTransaction[]): CheckReport {
  return {
    summary: summaryOf(checked),
    transactions: checked.map((result) => {
      const document = { ...result } as Partial<CheckedTransaction>;

      delete document.details;

      return document as Omit<CheckedTransaction, 'details'>;
    }),
  };
}

/**
 * The outcome of a Transaction whose pipeline ran to a conclusion.
 *
 * `passed` is the pipeline's own verdict. Everything else is re-read here,
 * because the pipeline has one axis (did the test case fail?) and this has two:
 * whether the transaction ran, and whether something upstream is why it did
 * not.
 */
export function checkedFromTestCase(
  testCase: HttpTestCase,
  transaction: ThymianHttpTransaction,
): CheckedTransaction {
  const actualStatus = testCase.steps[0]?.transactions[0]?.response?.statusCode;
  const seed = seedAnomaly(testCase, transaction);
  const outcome: Outcome =
    testCase.status === 'passed'
      ? 'passed'
      : // A Seed answered differently is why this transaction could not run as
        // described, whatever the pipeline called the case.
        seed
        ? 'skipped'
        : testCase.status === 'failed'
          ? 'failed'
          : 'skipped';
  const details = detailsOf(testCase);

  return {
    selector: selectorOf(transaction),
    expectedStatus: transaction.thymianRes.statusCode,
    ...(actualStatus === undefined ? {} : { actualStatus }),
    outcome,
    // Anything that is not `passed` says why, always: the documented `--json`
    // contract promises a `reason` for it, and a consumer should never have to
    // handle a failure that came with no sentence. A case that failed without
    // one hands over its first detail rather than repeating it below.
    ...(outcome === 'passed'
      ? {}
      : { reason: testCase.reason || details.shift() || FALLBACK[outcome] }),
    ...(seed ? { causedBy: seed } : {}),
    details,
  };
}

/** Last resort, for a pipeline verdict that arrived with nothing said. */
const FALLBACK: Record<Outcome, string> = {
  passed: '',
  failed: 'The response did not match the description.',
  skipped: 'This transaction could not be executed as described.',
  errored: 'The attempt broke.',
};

/**
 * The outcome of a Transaction whose attempt threw.
 *
 * A request that could not be built from the description is a Transaction that
 * cannot be executed *as described* — a skip. Anything else that throws broke
 * the attempt itself, which is what `errored` is for: a hook defect, a refused
 * connection, a body that will not serialize.
 */
export function checkedFromError(
  error: unknown,
  transaction: ThymianHttpTransaction,
): CheckedTransaction {
  return {
    selector: selectorOf(transaction),
    expectedStatus: transaction.thymianRes.statusCode,
    outcome: isRequestSerializationError(error) ? 'skipped' : 'errored',
    reason: error instanceof Error ? error.message : String(error),
    details: errorSuggestions(error),
  };
}

export function summaryOf(
  checked: readonly CheckedTransaction[],
): CheckSummary {
  const count = (outcome: Outcome) =>
    checked.filter((result) => result.outcome === outcome).length;

  return {
    passed: count('passed'),
    failed: count('failed'),
    skipped: count('skipped'),
    errored: count('errored'),
    total: checked.length,
  };
}

function selectorOf(transaction: ThymianHttpTransaction): Selector {
  return thymianHttpTransactionToString(
    transaction.thymianReq,
    transaction.thymianRes,
  );
}

/**
 * The Seed that explains this outcome: an `invalid-transaction` result carrying
 * a transaction other than the one being checked.
 *
 * Recorded by the hook runner when a `utils.request` call is answered with
 * something other than what its Selector named — the only place that knows a
 * nested request happened at all.
 */
function seedAnomaly(
  testCase: HttpTestCase,
  checked: ThymianHttpTransaction,
): Selector | undefined {
  for (const result of testCase.results) {
    if (result.type !== 'invalid-transaction' || !result.transaction) {
      continue;
    }

    if (result.transaction.transactionId === checked.transactionId) {
      continue;
    }

    return selectorOf(result.transaction);
  }

  return undefined;
}

/**
 * Everything worth printing under the header, each sentence once.
 *
 * The case's `reason` is printed by the caller, and every result that merely
 * repeats it is dropped: a status mismatch arrives twice — once as the reason
 * and once as the `invalid-transaction` result it was derived from — which is
 * how one sentence ended up on two consecutive lines.
 */
function detailsOf(testCase: HttpTestCase): string[] {
  const seen = new Set<string>([testCase.reason ?? '']);
  const details: string[] = [];

  for (const result of testCase.results) {
    for (const line of linesOf(result)) {
      if (line && !seen.has(line)) {
        seen.add(line);
        details.push(line);
      }
    }
  }

  return details;
}

function linesOf(result: HttpTestCaseResult): string[] {
  if (result.type === 'assertion-failure') {
    return [result.message];
  }

  if (result.type === 'invalid-transaction') {
    return [result.message, result.details ?? ''];
  }

  return [];
}
