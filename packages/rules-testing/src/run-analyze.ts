import {
  type CapturedTransaction,
  httpTransactionToLabel,
  NoopLogger,
  type RuleRunnerAdapter,
  type RuleViolationLocation,
  runRules,
  serializeRequest,
  type ThymianFormat,
  type ThymianHttpTransaction,
  thymianHttpTransactionToString,
} from '@thymian/core';
import { exampleRequestSampler } from '@thymian/core-testing';
import {
  AnalyticsApiContext,
  SqliteHttpTransactionRepository,
} from '@thymian/plugin-http-analyzer';

import { conformingResponse } from './conforming-response.js';
import {
  listExecutions,
  reportedExecutions,
  type RuleTestExecution,
  transactionLocated,
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
 * Runs a rule in `analytics`: the analyzer's own context evaluates it against
 * traffic held in memory, with the format present, and core's rule runner and
 * report builder turn what it returns into executions, as they do for
 * `thymian analyze`.
 *
 * The traffic is every transaction of the format recorded once, conforming.
 */
export async function runAnalyze(
  underTest: RuleUnderTest,
  format: ThymianFormat,
): Promise<RuleTestExecution[]> {
  const { rule, rulesConfig } = underTest;
  const traffic = await conformingTraffic(format);

  const repository = new SqliteHttpTransactionRepository(':memory:', logger);

  try {
    await repository.init();

    for (const pair of traffic) {
      repository.insertHttpTransaction(pair);
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
    const reported = reportedExecutions(result, underTest, format, 'analyze');

    const recordings = traffic.map(({ request, response }) => ({
      label: httpTransactionToLabel(request.data, response.data),
      transactionId: format.matchTransaction(request.data, response.data)?.[0],
    }));
    const recorded = new Set(
      recordings.map(({ transactionId }) => transactionId),
    );
    const transactionOfLabel = transactionsByLabel(recordings);
    const applicable = applicableTransactions(stated(), analyzerContext());

    // A transaction whose recording the format cannot tell from another's
    // has no recording of its own, and the rule was not asked about it there.
    return listExecutions(
      format,
      reported,
      (transactionId) =>
        recorded.has(transactionId) && (applicable?.has(transactionId) ?? true),
      (location: RuleViolationLocation) =>
        typeof location === 'string'
          ? transactionOfLabel.get(location)
          : transactionLocated(location),
    );
  } finally {
    await repository.close();
  }
}

/**
 * The transaction each recording's label is about: what the analyzer locates
 * on the label, from `validateCapturedHttpTransactions` and from
 * `validateCapturedHttpTraces` for a trace of one pair, is about the
 * transaction that recording matched. The label does not name the request's
 * media type, so recordings of two transactions can share one; such a label is
 * about neither.
 */
function transactionsByLabel(
  recordings: { label: string; transactionId: string | undefined }[],
): Map<string, string | undefined> {
  const byLabel = new Map<string, string | undefined>();

  for (const { label, transactionId } of recordings) {
    byLabel.set(
      label,
      byLabel.has(label) && byLabel.get(label) !== transactionId
        ? undefined
        : transactionId,
    );
  }

  return byLabel;
}

/**
 * Every transaction of the format recorded once, in the order it was added:
 * the request the format describes, with the examples it carries, and the
 * conforming response. Recorded as traffic read from a HAR file is by default,
 * a user agent talking to an origin server.
 */
async function conformingTraffic(
  format: ThymianFormat,
): Promise<CapturedTransaction[]> {
  return Promise.all(
    format.getThymianHttpTransactions().map(async (transaction) => ({
      request: {
        data: await conformingRequest(transaction),
        meta: { role: 'user-agent' },
      },
      response: {
        data: conformingResponse(transaction.thymianRes),
        meta: { role: 'origin server' },
      },
    })),
  );
}

/**
 * The request the tester would send for the transaction, naming the media
 * type the format declares for it: without it the analyzer does not recognise
 * the transaction in the recording.
 */
async function conformingRequest(transaction: ThymianHttpTransaction) {
  const { thymianReq, thymianRes } = transaction;

  try {
    const request = serializeRequest({
      requestTemplate: await exampleRequestSampler(transaction),
      source: transaction,
    });

    return {
      ...request,
      headers: {
        ...(thymianReq.mediaType === ''
          ? {}
          : { 'content-type': thymianReq.mediaType }),
        ...request.headers,
      },
    };
  } catch (error) {
    throw new Error(
      `Cannot record "${thymianHttpTransactionToString(thymianReq, thymianRes)}": ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
