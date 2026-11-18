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

function declaredAndLive(
  transaction: Pick<HttpTestCaseStepTransaction, 'source' | 'response'>,
): string {
  return `the description declares ${transaction.source?.thymianRes.statusCode}, the server answered ${transaction.response?.statusCode}`;
}

function hasStatusDrift(
  transaction: Pick<HttpTestCaseStepTransaction, 'source' | 'response'>,
): boolean {
  return (
    !!transaction.source &&
    !!transaction.response &&
    transaction.source.thymianRes.statusCode !== transaction.response.statusCode
  );
}

/**
 * The informational finding a named-form call adds to a pair it judged although
 * the live status differs from the declared one (ADR-0026). It neither skips nor
 * fails the execution.
 */
function statusDriftResult(
  location: RuleViolationLocation,
  transaction: Pick<HttpTestCaseStepTransaction, 'source' | 'response'>,
  transactionIndex: number,
): RuleFnResult {
  return {
    location,
    findings: [
      {
        kind: 'informational',
        title: 'Status drift',
        message: `The live status differs from the declared one: ${declaredAndLive(transaction)}.`,
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

/** Per-call association of test result with placement metadata. */
export type HttpTesterRuleDiagnostics = Array<{
  testResult: HttpTestResult;
  placements: RuleFnResultPlacement[];
}>;

export class HttpTestApiContext<
  Locals extends HttpTestContextLocals = HttpTestContextLocals,
> implements TestContext<HttpTesterRuleDiagnostics> {
  readonly format: ThymianFormat;
  private readonly ctx: HttpTestContext<Locals>;
  private readonly diagnosticEntries: HttpTesterRuleDiagnostics = [];

  constructor(
    private readonly name: string,
    ctx: HttpTestContext<Locals>,
    private readonly skippedOrigins: string[] = [],
  ) {
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
   * A pair the live re-check rejects was not judged: it is reported as a
   * `rule-skip` naming the declared and the live status (ADR-0026), not as a
   * pass.
   */
  private notApplicableResult(
    location: RuleViolationLocation,
    reason: string,
  ): RuleFnResult {
    return {
      location,
      findings: [
        {
          kind: 'rule-skip',
          title: this.name,
          message: `The rule does not apply to the live response: ${reason}.`,
        },
      ],
    };
  }

  getRuleExecutionDiagnostics(): HttpTesterRuleDiagnostics | undefined {
    return this.diagnosticEntries.length > 0
      ? this.diagnosticEntries
      : undefined;
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
        // replaces the status-code gate (ADR-0026).
        runRequests({ checkStatusCode: !liveAppliesTo }),
      ),
    );

    const testResult = await test(this.ctx);

    const callViolations: RuleFnResult<
      RuleViolationLocation | RuleViolationGroupLocation
    >[] = [];
    const placements: RuleFnResultPlacement[] = [];

    testResult.cases.forEach((value, testCaseIndex) => {
      if (value.status !== 'passed') {
        return;
      }
      const testCase = value as HttpTestCase<[GroupedHttpTestCaseStep]>;
      const { source, transactions } = testCase.steps[0];

      const applicable = transactions.flatMap(
        (transaction, transactionIndex) =>
          hasSource(transaction) &&
          (!liveAppliesTo ||
            (!!transaction.request &&
              !!transaction.response &&
              liveAppliesTo(
                transaction.request,
                transaction.response,
                transaction.source,
              )))
            ? [{ transaction, transactionIndex }]
            : [],
      );

      if (liveAppliesTo && applicable.length === 0) {
        const reasons = transactions
          .filter(hasSource)
          .map(
            (transaction) =>
              `${thymianHttpTransactionToString(transaction.source.thymianReq, transaction.source.thymianRes)}: ${declaredAndLive(transaction)}`,
          );
        const result = this.notApplicableResult(
          `${this.name}:${testCase.name}`,
          `none of the group's pairs matches (${reasons.join('; ')})`,
        );
        callViolations.push(result);
        placements.push({ result, testCaseIndex, stepIndex: 0 });
        return;
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

      const results = locateOnGroup(
        violatedWhen(source.key, transactionsToValidate),
        source.key,
        transactionsToValidate.map(([, , location]) => location),
      );

      if (liveAppliesTo) {
        for (const { transaction, transactionIndex } of applicable) {
          if (hasStatusDrift(transaction)) {
            results.push(
              statusDriftResult(
                {
                  elementId: transaction.source.transactionId,
                  elementType: 'edge',
                },
                transaction,
                transactionIndex,
              ),
            );
          }
        }
      }

      callViolations.push(...results);
      for (const result of results) {
        placements.push({ result, testCaseIndex, stepIndex: 0 });
      }
    });

    this.diagnosticEntries.push({ testResult, placements });

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
        // replaces the status-code gate (ADR-0026).
        .run({ checkStatusCode: !liveAppliesTo })
        .done(),
    );

    const testResult = await test(this.ctx);

    const callViolations: RuleFnResult[] = [];
    const placements: RuleFnResultPlacement[] = [];

    testResult.cases.forEach((testCase, testCaseIndex) => {
      if (testCase.status !== 'passed') {
        return;
      }
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

          if (liveAppliesTo && !liveAppliesTo(request, response, source)) {
            const result = this.notApplicableResult(
              location,
              declaredAndLive(transaction),
            );
            callViolations.push(result);
            placements.push({ result, testCaseIndex, stepIndex });
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
          callViolations.push(...results);
          for (const result of results) {
            if (
              typeof violatedWhen !== 'function' ||
              isSameLocation(result.location, location)
            ) {
              placements.push({ result, testCaseIndex, stepIndex });
            }
          }

          if (liveAppliesTo && hasStatusDrift(transaction)) {
            const result = statusDriftResult(
              location,
              transaction,
              transactionIndex,
            );
            callViolations.push(result);
            placements.push({ result, testCaseIndex, stepIndex });
          }
        }
      });
    });

    this.diagnosticEntries.push({ testResult, placements });

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

    this.diagnosticEntries.push({ testResult, placements });

    return ruleFnResult;
  }

  async runHttpTest(
    pipeline: HttpTestPipeline<Locals>,
  ): Promise<HttpTestResult> {
    const testFn = httpTest(this.name, pipeline);

    const testResult = await testFn(this.ctx);

    this.diagnosticEntries.push({ testResult, placements: [] });

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
        // replaces the status-code gate (ADR-0026).
        .run({ checkStatusCode: !liveAppliesTo })
        .done(),
    );

    const testResult = await test(this.ctx);

    const callViolations: RuleFnResult[] = [];
    const placements: RuleFnResultPlacement[] = [];

    testResult.cases.forEach((testCase, testCaseIndex) => {
      if (testCase.status !== 'passed') {
        return;
      }
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

          if (liveAppliesTo && !liveAppliesTo(request, response, source)) {
            const result = this.notApplicableResult(
              location,
              declaredAndLive(transaction),
            );
            callViolations.push(result);
            placements.push({ result, testCaseIndex, stepIndex });
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
          callViolations.push(...results);
          for (const result of results) {
            if (
              typeof violatedWhen !== 'function' ||
              isSameLocation(result.location, location)
            ) {
              placements.push({ result, testCaseIndex, stepIndex });
            }
          }

          if (liveAppliesTo && hasStatusDrift(transaction)) {
            const result = statusDriftResult(
              location,
              transaction,
              transactionIndex,
            );
            callViolations.push(result);
            placements.push({ result, testCaseIndex, stepIndex });
          }
        }
      });
    });

    this.diagnosticEntries.push({ testResult, placements });

    return callViolations;
  }
}
