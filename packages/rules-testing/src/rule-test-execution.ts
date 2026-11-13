import {
  executionsFromRunRulesResult,
  type FindingRecord,
  resolveViolationLocation,
  type Rule,
  type RuleSeverity,
  type RuleViolationLocation,
  type RunRulesResult,
  type ThymianFormat,
  thymianHttpTransactionToString,
} from '@thymian/core';

import type { RuleUnderTest } from './rule-under-test.js';

/**
 * `notApplicable` exists only in a rule test: the engines and the report know
 * `failed`, `passed` and `skipped`.
 */
export type RuleTestExecutionStatus =
  'failed' | 'passed' | 'notApplicable' | 'skipped';

/**
 * What a rule said about one location, in one validation context.
 */
export type RuleTestExecution = {
  /**
   * Where the engine located the execution: a transaction (an `edge` whose
   * `elementId` is the transaction id), a node, or a free string. Reported as
   * the engine gave it, with one addition: a node or edge location without a
   * `label` gets the label the engine prints for it in a report.
   */
  location: RuleViolationLocation;
  status: RuleTestExecutionStatus;
  /** Present when `failed`. */
  message?: string;
  /**
   * Present when `failed`: the severity the rule declares, which is `off` for
   * a rule that ships disabled.
   */
  severity?: RuleSeverity;
  /** Present when `skipped` and the rule gave a reason. */
  reason?: string;
  /**
   * What the rule attached to the execution, as the engine reports it in a
   * report: on a pass as much as on a violation. Empty when it attached
   * nothing, and on a transaction the engine reported no execution on.
   */
  findings: FindingRecord[];
};

/**
 * Arranges the executions of one run as the list a rule test compares against:
 * every transaction of the format in the order it was added, once per
 * execution the engine reported on it, then the executions the engine located
 * anywhere else.
 *
 * A transaction the engine reported nothing on is `passed` when the rule
 * applies to it and `notApplicable` when it does not. The engines report only
 * what a rule returns, so this is the one place that knows the difference.
 */
export function listExecutions(
  format: ThymianFormat,
  reported: RuleTestExecution[],
  isApplicable: (transactionId: string) => boolean,
): RuleTestExecution[] {
  const transactions = format.getThymianHttpTransactions();
  const reportedOn = new Map<string, RuleTestExecution[]>(
    transactions.map(({ transactionId }) => [transactionId, []]),
  );
  const reportedElsewhere: RuleTestExecution[] = [];

  for (const execution of reported) {
    const { location } = execution;
    const onTransaction =
      typeof location !== 'string' && location.elementType === 'edge'
        ? reportedOn.get(location.elementId)
        : undefined;

    (onTransaction ?? reportedElsewhere).push(execution);
  }

  return [
    ...transactions.flatMap(
      ({ transactionId, thymianReq, thymianRes }): RuleTestExecution[] => {
        const executions = reportedOn.get(transactionId) ?? [];

        return executions.length > 0
          ? executions
          : [
              {
                location: {
                  elementType: 'edge',
                  elementId: transactionId,
                  label: thymianHttpTransactionToString(thymianReq, thymianRes),
                },
                status: isApplicable(transactionId)
                  ? 'passed'
                  : 'notApplicable',
                findings: [],
              },
            ];
      },
    ),
    ...reportedElsewhere,
  ];
}

/**
 * The executions core's report builder makes of what the rule returned, as it
 * does for `thymian lint` and `thymian analyze`, each on the location the rule
 * returned it for.
 */
export function reportedExecutions(
  result: RunRulesResult,
  { rule, declaredSeverity }: RuleUnderTest,
  format: ThymianFormat,
  runType: 'lint' | 'analyze',
): RuleTestExecution[] {
  const entries = result[rule.meta.name]?.ruleFnResult ?? [];

  // One overload per run type, so the call is spelled out for each.
  const executions =
    runType === 'lint'
      ? executionsFromRunRulesResult(result, [rule], format, 'lint')
      : executionsFromRunRulesResult(result, [rule], format, 'analyze');

  return executions.map(({ status, findings }, index): RuleTestExecution => {
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
  });
}

/**
 * A location with the label the engine prints for it in a report, unless it
 * is a free string or the rule labelled it itself.
 */
export function withEngineLabel(
  location: RuleViolationLocation,
  format: ThymianFormat,
  rule: Rule,
): RuleViolationLocation {
  if (typeof location === 'string' || location.label !== undefined) {
    return location;
  }

  const { heading } = resolveViolationLocation(
    location,
    format,
    rule.meta.name,
  );

  return heading === '' ? location : { ...location, label: heading };
}
