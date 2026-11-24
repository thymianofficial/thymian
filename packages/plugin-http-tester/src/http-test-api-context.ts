import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  type CommonHttpRuleCriteria,
  createRegExpFromOriginWildcard,
  type GroupedCommonHttpRuleCriteria,
  type HttpFilterExpression,
  type HttpRequest,
  httpRequestToCommonHttpRequest,
  type HttpResponse,
  httpResponseToCommonHttpResponse,
  type HttpRuleCriteria,
  type HttpTestCaseResult,
  isRuleCriteria,
  isTestableTransaction,
  locateOnGroup,
  type RuleFnResult,
  type RuleViolationGroupLocation,
  type RuleViolationLocation,
  type TestContext,
  ThymianBaseError,
  ThymianFormat,
  type ThymianHttpTransaction,
  thymianHttpTransactionToString,
  thymianRequestToOrigin,
  type ValidationFn,
} from '@thymian/core';
import {
  generateRequests,
  type GroupedHttpTestCaseStep,
  httpTest,
  type HttpTestCase,
  type HttpTestCaseStepTransaction,
  type HttpTestContext,
  type HttpTestContextLocals,
  type HttpTestPipeline,
  type HttpTestResult,
  mapToGroupedTestCase,
  runRequests,
  singleTestCase,
} from '@thymian/core';
import { filter, groupBy } from 'rxjs';

import { httpFilterExpressionToFilter } from './visitors/http-filter-expression-to-filter.js';
import { httpFilterToGroupByFn } from './visitors/http-filter-to-static-by-fn.js';
import { httpFilterToTransactionValidationFn } from './visitors/http-filter-to-transaction-validation-fn.js';

function hasSource(
  transaction: HttpTestCaseStepTransaction,
): transaction is HttpTestCaseStepTransaction & {
  source: ThymianHttpTransaction;
} {
  return 'source' in transaction;
}

/** What a call recorded for one test case the live re-check rejected pairs in. */
type RejectedCase = NonNullable<
  HttpTesterCallDiagnostics['rejectedCases']
>[number];

function rejectedCasesField(
  rejectedCases: RejectedCase[],
): Pick<HttpTesterCallDiagnostics, 'rejectedCases'> {
  return rejectedCases.length > 0 ? { rejectedCases } : {};
}

/**
 * The rejected case for the pairs of one test case the live re-check
 * rejected, or `undefined` when it rejected none. The case gets the reason of
 * its pair when every pair sent in it was rejected.
 */
function rejectedCase(
  testCaseIndex: number,
  rejected: RejectedCase['rejected'],
  sent: number,
): RejectedCase | undefined {
  if (rejected.length === 0) {
    return undefined;
  }
  return {
    testCaseIndex,
    ...(rejected.length === sent ? { reason: rejected[0]?.reason } : {}),
    rejected,
  };
}

function isSameLocation(
  a: RuleViolationLocation | RuleViolationGroupLocation,
  b: RuleViolationLocation,
): boolean {
  if (typeof a === 'string' || typeof b === 'string') {
    return a === b;
  }
  return (
    a.elementType !== 'group' &&
    a.elementType === b.elementType &&
    a.elementId === b.elementId
  );
}

/** A sent pair next to the transaction the specification declares for it. */
type LivePair = {
  source: ThymianHttpTransaction;
  response: HttpResponse;
};

type LiveApplicability = ReturnType<typeof httpFilterToTransactionValidationFn>;

/** How the live status differs from the declared one; `undefined` when not. */
function declaredVersusLiveStatus({
  source,
  response,
}: LivePair): string | undefined {
  return source.thymianRes.statusCode === response.statusCode
    ? undefined
    : `the specification declares ${source.thymianRes.statusCode}, the server answered ${response.statusCode}`;
}

/** The parenthesis a message adds for the clauses given; none for none. */
function inParentheses(clauses: (string | undefined)[]): string {
  const given = clauses.filter((clause) => clause !== undefined);
  return given.length === 0 ? '' : ` (${given.join('; ')})`;
}

/**
 * Why the live re-check rejected one pair, naming the declared and the live
 * status where they differ (ADR-0028).
 */
function outsideApplicabilityReason(pair: LivePair | undefined): string {
  return `The live pair is outside the rule's applicability${inParentheses([pair && declaredVersusLiveStatus(pair)])}.`;
}

/**
 * The informational finding a named-form call adds to a pair it judged although
 * the live status differs from the declared one (ADR-0028), or `undefined` when
 * the status is the declared one. It neither skips nor fails the execution.
 */
function statusDriftResult(
  location: RuleViolationLocation,
  pair: LivePair,
  transactionIndex: number,
): RuleFnResult | undefined {
  const drift = declaredVersusLiveStatus(pair);
  if (drift === undefined) {
    return undefined;
  }

  return {
    location,
    findings: [
      {
        kind: 'informational',
        title: 'Status drift',
        message: `The live status differs from the declared one${inParentheses([drift])}.`,
        transactionIndex,
      },
    ],
  };
}

type EdgeLocation = {
  elementType: 'node' | 'edge';
  elementId: string;
  pointer?: string;
};

/**
 * Links a single RuleFnResult back to its position in the HTTP test run.
 * stepIndex is absent for test-case-level results (e.g. from httpTest()).
 */
export type RuleFnResultPlacement = {
  result: RuleFnResult<RuleViolationLocation | RuleViolationGroupLocation>;
  testCaseIndex: number;
  stepIndex?: number;
};

/** What one rule-context call ran, and where its results belong. */
export type HttpTesterCallDiagnostics = {
  testResult: HttpTestResult;
  placements: RuleFnResultPlacement[];
  /**
   * The test cases in which the live re-check of `appliesTo` rejected at least
   * one pair (ADR-0030). `reason` is set exactly when it rejected every pair sent
   * in the case, which makes the case `notApplicable`. Absent when there are none.
   */
  rejectedCases?: Array<{
    testCaseIndex: number;
    reason?: string;
    /** `transactionIndex` indexes the transactions of the case's first step. */
    rejected: Array<{ transactionIndex: number; reason: string }>;
  }>;
};

/** Why a rule applied to nothing (ADR-0030). */
export const NOT_APPLICABLE_REASONS = {
  noTransaction: 'The input has no transaction this rule applies to.',
  skipOrigins: 'skipOrigins excluded every transaction this rule applies to.',
} as const;

/** What the HTTP test context recorded while one rule ran. */
export type HttpTesterRuleDiagnostics = {
  /** One entry per rule-context call, in call order. */
  calls: HttpTesterCallDiagnostics[];
  /**
   * Set when no rule-context call's `appliesTo` accepted any transaction,
   * including when the rule made no call at all (ADR-0030).
   */
  notApplicable?: { reason: string };
};

export class HttpTestApiContext<
  Locals extends HttpTestContextLocals = HttpTestContextLocals,
> implements TestContext<HttpTesterRuleDiagnostics> {
  readonly format: ThymianFormat;
  private readonly ctx: HttpTestContext<Locals>;
  private readonly diagnosticEntries: HttpTesterCallDiagnostics[] = [];
  /** The format as it was before the `skipOrigins` filter. */
  private readonly unfilteredFormat: ThymianFormat;
  /** The `appliesTo` of every call, to tell the cause of "applied to nothing". */
  private readonly calledAppliesTo: HttpFilterExpression[] = [];
  /** Whether any call's applicability accepted at least one transaction. */
  private acceptedAny = false;

  constructor(
    private readonly name: string,
    ctx: HttpTestContext<Locals>,
    private readonly skippedOrigins: string[] = [],
  ) {
    this.unfilteredFormat = ctx.format;

    if (skippedOrigins.length === 0) {
      this.format = ctx.format;
    } else {
      const regExps = skippedOrigins.map(createRegExpFromOriginWildcard);

      this.format = ctx.format.filter(
        ({ thymianReq }) =>
          !regExps.some((regExp) =>
            regExp.test(thymianRequestToOrigin(thymianReq)),
          ),
      );
    }

    this.ctx = {
      ...ctx,
      format: this.format,
    };
  }

  /**
   * `appliesTo` selects what to send from the specification; this asks it again
   * of the pair that came back, so a pair it rejects never reaches
   * `violatedWhen` (ADR-0025). The positional form skips this re-check.
   */
  private liveApplicability(appliesTo: HttpFilterExpression) {
    return httpFilterToTransactionValidationFn(appliesTo, this.format);
  }

  /**
   * The named form's live check of one sent pair (ADR-0028): whether
   * `violatedWhen` judges it. A pair `appliesTo` rejects is not judged and
   * returns nothing; the call records it, with the `rejection` reason, as a
   * rejected case (ADR-0030). A pair judged with a status the specification
   * does not declare for it gets a Status drift finding as its `result`. The
   * positional form (`liveAppliesTo` undefined) judges every pair, without note.
   */
  private checkLivePair(
    liveAppliesTo: LiveApplicability | undefined,
    pair: LivePair & { request: HttpRequest },
    location: RuleViolationLocation,
    transactionIndex: number,
  ):
    | { judge: true; result?: RuleFnResult }
    | { judge: false; rejection: string } {
    if (!liveAppliesTo) {
      return { judge: true };
    }

    if (!liveAppliesTo(pair.request, pair.response, pair.source)) {
      return { judge: false, rejection: outsideApplicabilityReason(pair) };
    }

    return {
      judge: true,
      result: statusDriftResult(location, pair, transactionIndex),
    };
  }

  getRuleExecutionDiagnostics(): HttpTesterRuleDiagnostics {
    return {
      calls: this.diagnosticEntries,
      ...(this.acceptedAny
        ? {}
        : { notApplicable: { reason: this.notApplicableReason() } }),
    };
  }

  /**
   * Records one call. A call accepted something when it built at least one
   * test case: an `appliesTo` call builds one only for a transaction it
   * accepts, and a bespoke pipeline's own selection stands in for it. A call
   * whose cases the live re-check all rejected still accepted something.
   */
  private record(
    entry: HttpTesterCallDiagnostics,
    appliesTo?: HttpFilterExpression,
  ): void {
    this.diagnosticEntries.push(entry);
    if (appliesTo !== undefined) {
      this.calledAppliesTo.push(appliesTo);
    }
    if (entry.testResult.cases.length > 0) {
      this.acceptedAny = true;
    }
  }

  /**
   * Why the rule applied to nothing: `skipOrigins` excluded every match when
   * one of its `appliesTo` accepts a transaction of the format as it was
   * before the filter. Only evaluated for a rule that applied to nothing.
   */
  private notApplicableReason(): string {
    if (this.skippedOrigins.length === 0) {
      return NOT_APPLICABLE_REASONS.noTransaction;
    }

    const transactions = this.unfilteredFormat
      .getThymianHttpTransactions()
      .filter(isTestableTransaction);
    const keptAny = this.format
      .getThymianHttpTransactions()
      .some(isTestableTransaction);

    // With no call to ask, or only bespoke pipelines, the one thing known is
    // whether the filter left anything at all.
    const excluded =
      this.calledAppliesTo.length === 0
        ? transactions.length > 0 && !keptAny
        : this.calledAppliesTo.some((appliesTo) => {
            const isApplicable = httpFilterExpressionToFilter(appliesTo);
            return transactions.some((transaction) =>
              isApplicable(transaction, this.unfilteredFormat),
            );
          });

    return excluded
      ? NOT_APPLICABLE_REASONS.skipOrigins
      : NOT_APPLICABLE_REASONS.noTransaction;
  }

  async validateGroupedCommonHttpTransactions(
    criteria: GroupedCommonHttpRuleCriteria,
  ): Promise<
    RuleFnResult<RuleViolationLocation | RuleViolationGroupLocation>[]
  >;
  async validateGroupedCommonHttpTransactions(
    filterExpr: HttpFilterExpression,
    groupByExpression: HttpFilterExpression,
    validationFn: ValidationFn<
      [string, [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation][]]
    >,
  ): Promise<
    RuleFnResult<RuleViolationLocation | RuleViolationGroupLocation>[]
  >;
  async validateGroupedCommonHttpTransactions(
    appliesToOrCriteria: HttpFilterExpression | GroupedCommonHttpRuleCriteria,
    groupByArg?: HttpFilterExpression,
    violatedWhenArg?: ValidationFn<
      [string, [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation][]]
    >,
  ): Promise<
    RuleFnResult<RuleViolationLocation | RuleViolationGroupLocation>[]
  > {
    const [appliesTo, groupByExpression, violatedWhen, liveAppliesTo] =
      isRuleCriteria(appliesToOrCriteria)
        ? [
            appliesToOrCriteria.appliesTo,
            appliesToOrCriteria.groupBy,
            appliesToOrCriteria.violatedWhen,
            this.liveApplicability(appliesToOrCriteria.appliesTo),
          ]
        : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          [appliesToOrCriteria, groupByArg!, violatedWhenArg!, undefined];
    const isApplicable = httpFilterExpressionToFilter(appliesTo);
    const groupByFn = httpFilterToGroupByFn(groupByExpression);

    const test = httpTest(this.name, (test) =>
      test.pipe(
        filter(({ current, ctx }) => isApplicable(current, ctx.format)),
        groupBy(({ current, ctx }) => groupByFn(current, ctx.format)),
        mapToGroupedTestCase(),
        generateRequests(),
        // The named form re-checks `appliesTo` on every live pair, which
        // replaces the status-code gate (ADR-0028).
        runRequests({ checkStatusCode: !liveAppliesTo }),
      ),
    );

    const testResult = await test(this.ctx);

    const callViolations: RuleFnResult<
      RuleViolationLocation | RuleViolationGroupLocation
    >[] = [];
    const placements: RuleFnResultPlacement[] = [];
    const rejectedCases: RejectedCase[] = [];

    testResult.cases.forEach((value, testCaseIndex) => {
      if (value.status !== 'passed') {
        return;
      }
      const testCase = value as HttpTestCase<[GroupedHttpTestCaseStep]>;
      const { source, transactions } = testCase.steps[0];

      const isLiveApplicable = ({
        request,
        response,
        source,
      }: HttpTestCaseStepTransaction & { source: ThymianHttpTransaction }) =>
        !liveAppliesTo ||
        (!!request && !!response && liveAppliesTo(request, response, source));
      const applicable = transactions.flatMap(
        (transaction, transactionIndex) =>
          hasSource(transaction) && isLiveApplicable(transaction)
            ? [{ transaction, transactionIndex }]
            : [],
      );

      if (liveAppliesTo) {
        const sent = transactions.flatMap((transaction, transactionIndex) =>
          hasSource(transaction) ? [{ transaction, transactionIndex }] : [],
        );
        const rejected = sent.filter(
          ({ transactionIndex }) =>
            !applicable.some(
              (judged) => judged.transactionIndex === transactionIndex,
            ),
        );
        if (rejected.length > 0) {
          const differing = sent.map(
            ({ transaction: { source, response } }) => {
              const difference =
                response && declaredVersusLiveStatus({ source, response });
              return difference
                ? `${thymianHttpTransactionToString(source.thymianReq, source.thymianRes)}: ${difference}`
                : undefined;
            },
          );
          rejectedCases.push({
            testCaseIndex,
            ...(applicable.length === 0
              ? {
                  reason: `No live pair of the group is inside the rule's applicability${inParentheses(differing)}.`,
                }
              : {}),
            rejected: rejected.map(
              ({ transaction: { source, response }, transactionIndex }) => ({
                transactionIndex,
                reason: outsideApplicabilityReason(
                  response && { source, response },
                ),
              }),
            ),
          });
        }
        // The call returns nothing for a group none of whose members applies.
        if (applicable.length === 0) {
          return;
        }
      }

      const transactionsToValidate = applicable
        .map(({ transaction }) => transaction)
        .map<[CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]>(
          (transaction) => [
            httpRequestToCommonHttpRequest(
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              transaction.request!,
              {
                id: transaction.source.thymianReqId,
                logger: this.ctx.logger,
              },
            ),
            httpResponseToCommonHttpResponse(
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              transaction.response!,
              {
                id: transaction.source.thymianResId,
                logger: this.ctx.logger,
              },
            ),
            {
              elementId: transaction.source.transactionId,
              elementType: 'edge',
            },
          ],
        );

      const drifts = liveAppliesTo
        ? applicable.flatMap(({ transaction, transactionIndex }) => {
            const { response } = transaction;
            const drift =
              response &&
              statusDriftResult(
                {
                  elementId: transaction.source.transactionId,
                  elementType: 'edge',
                },
                { source: transaction.source, response },
                transactionIndex,
              );
            return drift ? [drift] : [];
          })
        : [];
      const results = [
        ...locateOnGroup(
          violatedWhen(source.key, transactionsToValidate),
          source.key,
          transactionsToValidate.map(([, , location]) => location),
        ),
        ...drifts,
      ];

      callViolations.push(...results);
      for (const result of results) {
        placements.push({ result, testCaseIndex, stepIndex: 0 });
      }
    });

    this.record(
      { testResult, placements, ...rejectedCasesField(rejectedCases) },
      appliesTo,
    );

    return callViolations;
  }

  async validateCommonHttpTransactions(
    criteria: CommonHttpRuleCriteria,
  ): Promise<RuleFnResult[]>;
  async validateCommonHttpTransactions(
    filterExpr: HttpFilterExpression,
    validate?:
      | ValidationFn<
          [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]
        >
      | HttpFilterExpression,
  ): Promise<RuleFnResult[]>;
  async validateCommonHttpTransactions(
    appliesToOrCriteria: HttpFilterExpression | CommonHttpRuleCriteria,
    violatedWhenArg?:
      | ValidationFn<
          [CommonHttpRequest, CommonHttpResponse, RuleViolationLocation]
        >
      | HttpFilterExpression,
  ): Promise<RuleFnResult[]> {
    const [appliesTo, violatedWhen, liveAppliesTo] = isRuleCriteria(
      appliesToOrCriteria,
    )
      ? [
          appliesToOrCriteria.appliesTo,
          appliesToOrCriteria.violatedWhen,
          this.liveApplicability(appliesToOrCriteria.appliesTo),
        ]
      : [
          appliesToOrCriteria,
          violatedWhenArg ?? appliesToOrCriteria,
          undefined,
        ];

    const test = httpTest(
      this.name,
      singleTestCase()
        .forTransactionsWith(appliesTo)
        // The named form re-checks `appliesTo` on the live pair, which
        // replaces the status-code gate (ADR-0028).
        .run({ checkStatusCode: !liveAppliesTo })
        .done(),
    );

    const testResult = await test(this.ctx);

    const callViolations: RuleFnResult[] = [];
    const placements: RuleFnResultPlacement[] = [];
    const rejectedCases: RejectedCase[] = [];

    testResult.cases.forEach((testCase, testCaseIndex) => {
      if (testCase.status !== 'passed') {
        return;
      }
      const rejected: RejectedCase['rejected'] = [];
      let sent = 0;
      testCase.steps.forEach((step, stepIndex) => {
        for (const [
          transactionIndex,
          transaction,
        ] of step.transactions.entries()) {
          const { request, response, source } = transaction;

          if (!request || !response || !source) {
            throw new Error('Invalid HTTP test case transaction.');
          }

          const location: RuleViolationLocation = {
            elementType: 'edge',
            elementId: source.transactionId,
          };

          const live = this.checkLivePair(
            liveAppliesTo,
            { request, response, source },
            location,
            transactionIndex,
          );
          sent++;
          if (!live.judge) {
            rejected.push({ transactionIndex, reason: live.rejection });
            continue;
          }
          const results: RuleFnResult[] = [];
          if (typeof violatedWhen === 'function') {
            results.push(
              ...violatedWhen(
                httpRequestToCommonHttpRequest(request, {
                  id: source.thymianReqId,
                  logger: this.ctx.logger,
                }),
                httpResponseToCommonHttpResponse(response, {
                  id: source.thymianResId,
                  logger: this.ctx.logger,
                }),
                location,
              ),
            );
          } else {
            const isViolated = httpFilterToTransactionValidationFn(
              violatedWhen,
              this.format,
            );
            if (isViolated(request, response, source)) {
              results.push({
                location: { ...location, pointer: '' },
                violation: {},
                findings: [],
              });
            }
          }
          if (live.result) {
            results.push(live.result);
          }
          callViolations.push(...results);
          for (const result of results) {
            if (
              typeof violatedWhen !== 'function' ||
              isSameLocation(result.location, location)
            ) {
              placements.push({ result, testCaseIndex, stepIndex });
            }
          }
        }
      });
      const caseRejected = rejectedCase(testCaseIndex, rejected, sent);
      if (caseRejected) {
        rejectedCases.push(caseRejected);
      }
    });

    this.record(
      { testResult, placements, ...rejectedCasesField(rejectedCases) },
      appliesTo,
    );

    return callViolations;
  }

  async httpTest(pipeline: HttpTestPipeline<Locals>): Promise<RuleFnResult[]> {
    const testFn = httpTest(this.name, pipeline);

    const testResult = await testFn(this.ctx);

    const ruleFnResult: RuleFnResult[] = [];
    const placements: RuleFnResultPlacement[] = [];

    testResult.cases.forEach((testCase, testCaseIndex) => {
      if (testCase.status !== 'failed') {
        return;
      }

      // A `failed` case is a real *test* failure only when an assertion actually
      // failed. Prefer an assertion failure anchored to a transaction so the
      // violation renders on the right edge/step; otherwise take any assertion
      // failure (e.g. from a top-level `expect`) and surface it at the case level.
      const assertionFailures = testCase.results.filter(
        (r) => r.type === 'assertion-failure',
      ) as Extract<HttpTestCaseResult, { type: 'assertion-failure' }>[];
      const assertionFailure =
        assertionFailures.find((r) => !!r.transaction) ?? assertionFailures[0];

      // No assertion failed ⇒ the case could not be executed (an HTTP-level
      // failure); computeTestCaseStatus intentionally surfaces that as skipped,
      // so leave it unplaced.
      if (assertionFailure === undefined) {
        return;
      }

      // Mark the case as violated for status derivation, keeping the assertion
      // detail on the raw test-case `results`; the report mapping (index.ts
      // `buildTestStep`) maps those results into findings so all
      // HttpTestCaseResult → report mapping lives in one place. When the failure
      // is anchored to a transaction we locate it on that edge; otherwise it is
      // a case-level violation.
      const result: RuleFnResult = assertionFailure.transaction
        ? {
            location: {
              elementId: assertionFailure.transaction.transactionId,
              elementType: 'edge',
            },
            violation: {},
            findings: [],
          }
        : {
            location: `${this.name}:${testCase.name}`,
            violation: {},
            findings: [],
          };
      ruleFnResult.push(result);
      // stepIndex is undefined when the assertion failure has no step location,
      // making this a test-case-level placement (intentional — see createRuns).
      placements.push({
        result,
        testCaseIndex,
        stepIndex: assertionFailure.location?.stepIdx,
      });
    });

    this.record({ testResult, placements });

    return ruleFnResult;
  }

  async runHttpTest(
    pipeline: HttpTestPipeline<Locals>,
  ): Promise<HttpTestResult> {
    const testFn = httpTest(this.name, pipeline);

    const testResult = await testFn(this.ctx);

    this.record({ testResult, placements: [] });

    return testResult;
  }

  async validateHttpTransactions(
    criteria: HttpRuleCriteria,
  ): Promise<RuleFnResult[]>;
  async validateHttpTransactions(
    filterExpr: HttpFilterExpression,
    validation?:
      | ValidationFn<[HttpRequest, HttpResponse, EdgeLocation]>
      | HttpFilterExpression,
  ): Promise<RuleFnResult[]>;
  async validateHttpTransactions(
    appliesToOrCriteria: HttpFilterExpression | HttpRuleCriteria,
    violatedWhenArg?:
      | ValidationFn<[HttpRequest, HttpResponse, EdgeLocation]>
      | HttpFilterExpression,
  ): Promise<RuleFnResult[]> {
    const [appliesTo, violatedWhen, liveAppliesTo] = isRuleCriteria(
      appliesToOrCriteria,
    )
      ? [
          appliesToOrCriteria.appliesTo,
          appliesToOrCriteria.violatedWhen,
          this.liveApplicability(appliesToOrCriteria.appliesTo),
        ]
      : [
          appliesToOrCriteria,
          violatedWhenArg ?? appliesToOrCriteria,
          undefined,
        ];

    const test = httpTest(
      this.name,
      singleTestCase()
        .forTransactionsWith(appliesTo)
        // The named form re-checks `appliesTo` on the live pair, which
        // replaces the status-code gate (ADR-0028).
        .run({ checkStatusCode: !liveAppliesTo })
        .done(),
    );

    const testResult = await test(this.ctx);

    const callViolations: RuleFnResult[] = [];
    const placements: RuleFnResultPlacement[] = [];
    const rejectedCases: RejectedCase[] = [];

    testResult.cases.forEach((testCase, testCaseIndex) => {
      if (testCase.status !== 'passed') {
        return;
      }
      const rejected: RejectedCase['rejected'] = [];
      let sent = 0;
      testCase.steps.forEach((step, stepIndex) => {
        for (const [
          transactionIndex,
          transaction,
        ] of step.transactions.entries()) {
          const { request, response, source } = transaction;

          if (!request || !response || !source) {
            throw new ThymianBaseError(
              'Invalid HTTP test case transaction: missing request, response, or source.',
            );
          }

          const location: RuleViolationLocation = {
            elementType: 'edge',
            elementId: source.transactionId,
            pointer: '',
          };

          const live = this.checkLivePair(
            liveAppliesTo,
            { request, response, source },
            location,
            transactionIndex,
          );
          sent++;
          if (!live.judge) {
            rejected.push({ transactionIndex, reason: live.rejection });
            continue;
          }
          const results: RuleFnResult[] = [];
          if (typeof violatedWhen === 'function') {
            results.push(...violatedWhen(request, response, location));
          } else {
            const isViolated = httpFilterToTransactionValidationFn(
              violatedWhen,
              this.format,
            );
            if (isViolated(request, response, source)) {
              results.push({ location, violation: {}, findings: [] });
            }
          }
          if (live.result) {
            results.push(live.result);
          }
          callViolations.push(...results);
          for (const result of results) {
            if (
              typeof violatedWhen !== 'function' ||
              isSameLocation(result.location, location)
            ) {
              placements.push({ result, testCaseIndex, stepIndex });
            }
          }
        }
      });
      const caseRejected = rejectedCase(testCaseIndex, rejected, sent);
      if (caseRejected) {
        rejectedCases.push(caseRejected);
      }
    });

    this.record(
      { testResult, placements, ...rejectedCasesField(rejectedCases) },
      appliesTo,
    );

    return callViolations;
  }
}
