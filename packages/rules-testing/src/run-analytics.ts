import {
  NoopLogger,
  type RuleRunnerAdapter,
  runRules,
  type ThymianFormat,
} from '@thymian/core';
import {
  AnalyticsApiContext,
  SqliteHttpTransactionRepository,
} from '@thymian/plugin-http-analyzer';

import { recorded, type RecordedPair } from './recorded.js';
import {
  executionsElsewhere,
  executionsOn,
  reportedExecutions,
  reportedOn,
  type RuleTestExecution,
} from './rule-test-execution.js';
import type { RuleUnderTest } from './rule-under-test.js';
import {
  type ApplicabilityCalls,
  applicableTransactions,
  observeApplicability,
  type StatedApplicability,
} from './stated-applicability.js';

const logger = new NoopLogger();

/**
 * The analyzer takes every Applicability as a filter expression, asked of the
 * recorded pair. Only a rule that reads whole traces states none.
 */
const applicabilityCalls: ApplicabilityCalls = {
  stating: new Set([
    'validateCommonHttpTransactions',
    'validateGroupedCommonHttpTransactions',
    'validateHttpTransactions',
    'validateCapturedHttpTransactions',
  ]),
  notStating: new Set(['validateCapturedHttpTraces']),
};

/**
 * What the analyzer said about one body of traffic: the executions it
 * reported, and whether the rule applies to a transaction as recorded there.
 */
type Analysis = {
  reported: RuleTestExecution[];
  isApplicable(transactionId: string): boolean;
};

/**
 * Runs a rule in `analytics` against the traffic: every transaction of the
 * format recorded once, conforming, unless traffic is handed in.
 *
 * The list is the recordings in traffic order, each on the transaction of the
 * format it matches, then the transactions that were never recorded, then the
 * executions the engine located anywhere else. A recording that matches no
 * transaction has no entry of its own: what the engine reports on it, it
 * locates on a free string.
 */
export async function runAnalytics(
  underTest: RuleUnderTest,
  format: ThymianFormat,
  traffic: RecordedPair[] = format
    .getThymianHttpTransactions()
    .map(({ transactionId }) => recorded(format, transactionId)),
): Promise<RuleTestExecution[]> {
  const transactions = format.getThymianHttpTransactions();
  // Per recording, in traffic order: the id of the transaction it matches.
  const matched = traffic.map((pair) => matchedTransaction(format, pair));

  const whole = await analyze(underTest, format, traffic);

  // The analyzer locates an execution on the transaction, not on the
  // recording. Which recording of a transaction recorded several times an
  // execution is about is therefore asked of each of them alone.
  const alone = new Map<number, Analysis>();
  for (const { transactionId } of transactions) {
    const recordings = [...matched.keys()].filter(
      (index) => matched[index] === transactionId,
    );
    if (recordings.length < 2) {
      continue;
    }

    const analyses: Analysis[] = [];
    for (const index of recordings) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      analyses.push(await analyze(underTest, format, [traffic[index]!]));
    }

    // A rule that compares recordings with each other says something else
    // about one of them alone. What it reported on the transaction with all
    // of them present then stands for every recording of it.
    const reportedAlone = analyses.flatMap(({ reported }) =>
      reportedOn(transactionId, reported),
    );
    if (
      reportedAlone.length === reportedOn(transactionId, whole.reported).length
    ) {
      recordings.forEach((index, position) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        alone.set(index, analyses[position]!);
      });
    }
  }

  const byId = new Map(
    transactions.map((transaction) => [transaction.transactionId, transaction]),
  );

  return [
    ...matched.flatMap((transactionId, index) => {
      const transaction =
        transactionId === undefined ? undefined : byId.get(transactionId);
      if (transaction === undefined) {
        return [];
      }

      const { reported, isApplicable } = alone.get(index) ?? whole;

      return executionsOn(
        transaction,
        reported,
        isApplicable(transaction.transactionId) ? 'passed' : 'notApplicable',
      );
    }),
    ...transactions
      .filter(({ transactionId }) => !matched.includes(transactionId))
      .flatMap((transaction) =>
        executionsOn(transaction, whole.reported, 'notApplicable'),
      ),
    ...executionsElsewhere(transactions, whole.reported),
  ];
}

/**
 * The analyzer's own context evaluates the rule against the traffic, held in
 * memory, with the format present, and core's rule runner and report builder
 * turn what it returns into executions, as they do for `thymian analyze`.
 *
 * Each pair is recorded as traffic read from a HAR file is by default, a user
 * agent talking to an origin server.
 */
async function analyze(
  underTest: RuleUnderTest,
  format: ThymianFormat,
  traffic: RecordedPair[],
): Promise<Analysis> {
  const { rule, rulesConfig } = underTest;
  const repository = new SqliteHttpTransactionRepository(':memory:', logger);

  try {
    await repository.init();

    for (const { request, response } of traffic) {
      repository.insertHttpTransaction({
        request: { data: request, meta: { role: 'user-agent' } },
        response: { data: response, meta: { role: 'origin server' } },
      });
    }

    const analyzerContext = () =>
      new AnalyticsApiContext({
        repository,
        logger,
        format,
        roles: rule.meta.appliesTo,
      });

    let stated: () => StatedApplicability = () => undefined;

    const adapter: RuleRunnerAdapter<AnalyticsApiContext> = {
      errorName: 'AnalyzeLinterError',
      mode: 'analytics',
      getRuleFn: (rule) => rule.analyzeRule,
      createContext: () => {
        const observed = observeApplicability(
          analyzerContext(),
          applicabilityCalls,
        );
        stated = observed.stated;
        return observed.context;
      },
    };

    const result = await runRules(logger, [rule], format, rulesConfig, adapter);
    const applicable = applicableTransactions(stated(), analyzerContext());

    return {
      reported: reportedExecutions(result, underTest, format, 'analyze'),
      isApplicable: (transactionId) => applicable?.has(transactionId) ?? true,
    };
  } finally {
    await repository.close();
  }
}

/**
 * The id of the transaction the analyzer recognises in the recording. None
 * when the recording matches no transaction or more than one, or cannot be
 * asked of the format at all, as for an origin that is no URL.
 */
function matchedTransaction(
  format: ThymianFormat,
  { request, response }: RecordedPair,
): string | undefined {
  try {
    return format.matchTransaction(request, response)?.[0];
  } catch {
    return undefined;
  }
}
