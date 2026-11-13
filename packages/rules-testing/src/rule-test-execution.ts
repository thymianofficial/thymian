import {
  type RuleSeverity,
  type RuleViolationLocation,
  type ThymianFormat,
  thymianHttpTransactionToString,
} from '@thymian/core';

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
  /** Present when `failed`: the severity the rule declares. */
  severity?: RuleSeverity;
  /** Present when `skipped` and the rule gave a reason. */
  reason?: string;
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
              },
            ];
      },
    ),
    ...reportedElsewhere,
  ];
}
