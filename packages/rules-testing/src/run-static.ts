import {
  executionsFromRunRulesResult,
  type HttpFilterExpression,
  NoopLogger,
  type RuleFnResult,
  type RuleRunnerAdapter,
  runRules,
  type ThymianFormat,
} from '@thymian/core';
import { StaticApiContext } from '@thymian/plugin-http-linter';

import {
  listExecutions,
  type RuleTestExecution,
  withEngineLabel,
} from './rule-test-execution.js';
import type { RuleUnderTest } from './rule-under-test.js';
import {
  observeApplicability,
  type StatedApplicability,
} from './stated-applicability.js';

const logger = new NoopLogger();

/**
 * Runs a rule in `static`: the linter's own context evaluates it against the
 * format, and core's rule runner and report builder turn what it returns into
 * executions, as they do for `thymian lint`.
 */
export async function runStatic(
  { rule, rulesConfig, declaredSeverity }: RuleUnderTest,
  format: ThymianFormat,
): Promise<RuleTestExecution[]> {
  let stated: () => StatedApplicability = () => undefined;

  const adapter: RuleRunnerAdapter<StaticApiContext> = {
    errorName: 'StaticLinterError',
    mode: 'static',
    getRuleFn: (rule) => rule.lintRule,
    createContext: () => {
      const observed = observeApplicability(
        new StaticApiContext(format, logger),
      );
      stated = observed.stated;
      return observed.context;
    },
  };

  const result = await runRules(logger, [rule], format, rulesConfig, adapter);
  const entries = result[rule.meta.name]?.ruleFnResult ?? [];
  const executions = executionsFromRunRulesResult(
    result,
    [rule],
    format,
    'lint',
  );

  const reported = executions.map(
    ({ status, findings }, index): RuleTestExecution => {
      // The report builder emits one execution per entry, in entry order.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { location } = entries[index]!;

      return {
        location: withEngineLabel(location, format, rule),
        status: status.kind,
        ...(status.kind === 'failed'
          ? { message: status.reason, severity: declaredSeverity }
          : {}),
        ...(status.kind === 'skipped' && status.reason !== undefined
          ? { reason: status.reason }
          : {}),
        findings,
      };
    },
  );

  const applicable = applicableTransactions(stated(), format);

  return listExecutions(
    format,
    reported,
    (transactionId) => applicable?.has(transactionId) ?? true,
  );
}

/**
 * The transactions the stated Applicability accepts, asked of the linter's
 * context in a call of its own; `undefined` when the rule stated none, so that
 * every transaction counts as applicable.
 */
function applicableTransactions(
  stated: StatedApplicability,
  format: ThymianFormat,
): Set<string> | undefined {
  if (stated === undefined) {
    return undefined;
  }

  const context = new StaticApiContext(format, logger);

  return new Set(
    stated
      .flatMap((appliesTo: HttpFilterExpression) =>
        context.validateCommonHttpTransactions({
          appliesTo,
          violatedWhen: (_req, _res, location): RuleFnResult[] => [
            { location, findings: [] },
          ],
        }),
      )
      .map(({ location }) =>
        typeof location === 'string' ? location : location.elementId,
      ),
  );
}
