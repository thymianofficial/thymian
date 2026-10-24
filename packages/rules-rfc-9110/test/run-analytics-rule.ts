import {
  type CapturedTransaction,
  NoopLogger,
  type Rule,
  type RuleFnResult,
  runRules,
  ThymianFormat,
} from '@thymian/core';
import {
  AnalyticsApiContext,
  SqliteHttpTransactionRepository,
} from '@thymian/plugin-http-analyzer';

/**
 * Runs a rule's `analytics` function through core's `runRules` and the real
 * `AnalyticsApiContext`, as `plugin-http-analyzer` drives it, over an
 * in-memory repository holding `transactions`.
 */
export async function runAnalyticsRule(
  rule: Rule,
  transactions: CapturedTransaction[],
): Promise<RuleFnResult[]> {
  const logger = new NoopLogger();
  const format = new ThymianFormat();
  const repository = new SqliteHttpTransactionRepository(':memory:', logger);
  await repository.init();

  for (const transaction of transactions) {
    repository.insertHttpTransaction(transaction);
  }

  try {
    const results = await runRules(
      logger,
      [rule],
      format,
      {},
      {
        errorName: 'AnalyticsRuleError',
        mode: 'analytics',
        getRuleFn: (r) => r.analyzeRule,
        createContext: (r) =>
          new AnalyticsApiContext({
            repository,
            logger,
            format,
            roles: r.meta.appliesTo,
          }),
      },
    );

    return results[rule.meta.name]?.ruleFnResult ?? [];
  } finally {
    repository.close();
  }
}

/** A recorded GET from a user agent carrying `range`, answered with a 206. */
export function rangeRequest(range: string | string[]): CapturedTransaction {
  return {
    request: {
      data: {
        origin: 'https://example.com',
        path: '/audio.wav',
        method: 'get',
        headers: { range },
      },
      meta: { role: 'user-agent' },
    },
    response: {
      data: {
        statusCode: 206,
        headers: { 'content-range': 'bytes 0-99/100' },
        trailers: {},
        duration: 1,
      },
      meta: { role: 'origin server' },
    },
  };
}
