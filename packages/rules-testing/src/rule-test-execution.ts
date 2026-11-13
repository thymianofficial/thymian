import {
  executionsFromRunRulesResult,
  type FindingRecord,
  isRuleViolationGroupLocation,
  resolveViolationLocation,
  type Rule,
  type RuleSeverity,
  type RuleViolationLocation,
  type RunRulesResult,
  type ThymianFormat,
  type ThymianHttpTransaction,
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
   * Present when a grouped rule located the execution on a group as a whole
   * and not on one of its members: the group key. Every member of the group
   * then carries the execution, each on its own location.
   */
  group?: string;
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

  return [
    ...transactions.flatMap((transaction) =>
      executionsOn(
        transaction,
        reported,
        isApplicable(transaction.transactionId) ? 'passed' : 'notApplicable',
      ),
    ),
    ...executionsElsewhere(transactions, reported),
  ];
}

/**
 * The executions the engine located on the transaction, in the order it
 * reported them, or the one filled in for a transaction it reported nothing
 * on, with the status given.
 */
export function executionsOn(
  { transactionId, thymianReq, thymianRes }: ThymianHttpTransaction,
  reported: RuleTestExecution[],
  unreported: 'passed' | 'notApplicable',
): RuleTestExecution[] {
  const executions = reportedOn(transactionId, reported);

  return executions.length > 0
    ? executions
    : [
        {
          location: {
            elementType: 'edge',
            elementId: transactionId,
            label: thymianHttpTransactionToString(thymianReq, thymianRes),
          },
          status: unreported,
          findings: [],
        },
      ];
}

/** The executions the engine located on the transaction. */
export function reportedOn(
  transactionId: string,
  reported: RuleTestExecution[],
): RuleTestExecution[] {
  return reported.filter(
    ({ location }) => transactionOf(location) === transactionId,
  );
}

/**
 * The executions the engine located on none of the transactions: on a node,
 * on a free string, or on an edge that is not one of them.
 */
export function executionsElsewhere(
  transactions: ThymianHttpTransaction[],
  reported: RuleTestExecution[],
): RuleTestExecution[] {
  const ids = new Set(transactions.map(({ transactionId }) => transactionId));

  return reported.filter(({ location }) => {
    const transactionId = transactionOf(location);

    return transactionId === undefined || !ids.has(transactionId);
  });
}

function transactionOf(location: RuleViolationLocation): string | undefined {
  return typeof location !== 'string' && location.elementType === 'edge'
    ? location.elementId
    : undefined;
}

/**
 * The executions core's report builder makes of what the rule returned, as it
 * does for `thymian lint` and `thymian analyze`, each on the location the rule
 * returned it for. An execution on a group is listed once per member of the
 * group, on the member, with the group key.
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

  return executions.flatMap(({ status, findings }, index) => {
    // The report builder emits one execution per entry, in entry order.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { location } = entries[index]!;
    const said = {
      status: status.kind,
      ...(status.kind === 'failed'
        ? { message: status.reason, severity: declaredSeverity }
        : {}),
      ...(status.kind === 'skipped' && status.reason !== undefined
        ? { reason: status.reason }
        : {}),
      findings,
    };

    // What a rule says about a group, it says about every member of it.
    return isRuleViolationGroupLocation(location)
      ? location.members.map((member): RuleTestExecution => ({
          location: withEngineLabel(member, format, rule),
          ...said,
          group: location.key,
        }))
      : [{ location: withEngineLabel(location, format, rule), ...said }];
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
