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

// `runRules` skips a rule whose severity is `off`, which would make every
// "stays silent" assertion pass without the rule running; run it at `warn`.
function enabled(rule: Rule): Rule {
  return rule.meta.severity === 'off'
    ? { ...rule, meta: { ...rule.meta, severity: 'warn' } }
    : rule;
}

/**
 * Runs a rule's `analyze` function through the real `AnalyticsApiContext`
 * over an in-memory SQLite repository holding `transactions`, driven by
 * core's `runRules` as `plugin-http-analyzer`'s adapter drives it.
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
      [enabled(rule)],
      format,
      {},
      {
        errorName: 'AnalyticsRuleTestError',
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
