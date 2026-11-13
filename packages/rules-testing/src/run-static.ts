import {
  NoopLogger,
  type RuleRunnerAdapter,
  runRules,
  type ThymianFormat,
} from '@thymian/core';
import { StaticApiContext } from '@thymian/plugin-http-linter';

import {
  listExecutions,
  reportedExecutions,
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

/** The linter's `validateHttpTransactions` decides in a plain callback. */
const applicabilityCalls: ApplicabilityCalls = {
  stating: new Set([
    'validateCommonHttpTransactions',
    'validateGroupedCommonHttpTransactions',
  ]),
  notStating: new Set(['validateHttpTransactions']),
};

/**
 * Runs a rule in `static`: the linter's own context evaluates it against the
 * format, and core's rule runner and report builder turn what it returns into
 * executions, as they do for `thymian lint`.
 */
export async function runStatic(
  underTest: RuleUnderTest,
  format: ThymianFormat,
): Promise<RuleTestExecution[]> {
  const { rule, rulesConfig } = underTest;
  let stated: () => StatedApplicability = () => undefined;

  const adapter: RuleRunnerAdapter<StaticApiContext> = {
    errorName: 'StaticLinterError',
    mode: 'static',
    getRuleFn: (rule) => rule.lintRule,
    createContext: () => {
      const observed = observeApplicability(
        new StaticApiContext(format, logger),
        applicabilityCalls,
      );
      stated = observed.stated;
      return observed.context;
    },
  };

  const result = await runRules(logger, [rule], format, rulesConfig, adapter);
  const reported = reportedExecutions(result, underTest, format, 'lint');

  const applicable = applicableTransactions(
    stated(),
    new StaticApiContext(format, logger),
  );

  return listExecutions(
    format,
    reported,
    (transactionId) => applicable?.has(transactionId) ?? true,
  );
}
