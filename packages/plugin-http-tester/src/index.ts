import { randomUUID } from 'node:crypto';

import {
  createContextFromEmitter,
  createTestCaseExecution,
  createTestStep,
  createToolRun,
  type ExecutionStatus,
  type FindingRecord,
  type HttpTestCase,
  type HttpTestCaseResult,
  type HttpTestCaseStep,
  type HttpTestResult,
  httpTestResultToRuleFindings,
  isCustomHttpTestCaseStep,
  isGroupedHttpTestCaseStep,
  isSingleHttpTestCaseStep,
  type Location,
  type Logger,
  type ReportHttpTransaction,
  resolveViolationLocation,
  type Rule,
  ruleFindingToFindingRecord,
  type RuleFnResult,
  type RuleRunnerAdapter,
  rulesToRuleDescriptors,
  runRules,
  type RunRulesResult,
  type SingleRuleConfiguration,
  type TestCaseExecution,
  type TestStep,
  ThymianBaseError,
  ThymianFormat,
  type ThymianPlugin,
  type ToolRun,
} from '@thymian/core';

import {
  HttpTestApiContext,
  type HttpTesterRuleDiagnostics,
  type RuleFnResultPlacement,
} from './http-test-api-context.js';

export {
  HttpTestApiContext,
  type HttpTesterRuleDiagnostics,
  type RuleFnResultPlacement,
} from './http-test-api-context.js';

/**
 * A step-level rule violation is kept so a failed step stays visible, but
 * WITHOUT a `ruleId` — rule attribution at step granularity is intentionally not
 * represented; the owning {@link TestCaseExecution}'s `ruleId` identifies the rule.
 */
function ruleViolationToStepFinding(
  violation: NonNullable<RuleFnResult['violation']>,
  rule: Rule,
): FindingRecord {
  const message = violation.message;
  return {
    id: randomUUID(),
    kind: 'rule-violation',
    title:
      message || (rule.meta.summary ?? rule.meta.description ?? rule.meta.name),
    ...(message
      ? { message: { text: message } }
      : rule.meta.explanation
        ? { message: { text: rule.meta.explanation } }
        : {}),
  } satisfies FindingRecord;
}

function buildTestStep(
  step: HttpTestCaseStep,
  stepIndex: number,
  casePlacements: RuleFnResultPlacement[],
  caseResults: readonly HttpTestCaseResult[],
  rule: Rule,
  location: Location,
): TestStep {
  // Associate results with this step by their placement `stepIndex` (which the
  // context derives from each result's `location.stepIdx`), rather than relying
  // on the caller to pre-filter.
  const stepPlacements = casePlacements.filter(
    (p) => p.stepIndex === stepIndex,
  );

  // Build the step's transactions, keeping a map from a transaction's raw index
  // in `step.transactions` to its index in the (filtered) `httpTransactions`, so
  // a finding's `transactionIndex` can be re-based onto the exposed array.
  const httpTransactions: ReportHttpTransaction[] = [];
  const rawToExposedTxIndex = new Map<number, number>();
  step.transactions.forEach((t, rawIdx) => {
    if (t.request !== undefined && t.response !== undefined) {
      rawToExposedTxIndex.set(rawIdx, httpTransactions.length);
      httpTransactions.push({ request: t.request, response: t.response });
    }
  });

  const rebaseTransactionIndex = (finding: FindingRecord): FindingRecord => {
    if (finding.transactionIndex === undefined) {
      return finding;
    }
    const exposed = rawToExposedTxIndex.get(finding.transactionIndex);
    if (exposed === undefined) {
      const rest = { ...finding };
      delete rest.transactionIndex;
      return rest;
    }
    return { ...finding, transactionIndex: exposed };
  };

  // Detail findings come from two sources, both funneled through the shared
  // HttpTestCaseResult/RuleFinding → FindingRecord mappers so all mapping lives
  // in one place: rule-based validation results carried on `RuleFnResult.findings`,
  // and the case's raw `HttpTestCaseResult`s tied to this step by `location.stepIdx`.
  const detailRecords: FindingRecord[] = [];

  for (const { result } of stepPlacements) {
    for (const finding of result.findings) {
      const record = ruleFindingToFindingRecord(finding);
      if (record) {
        detailRecords.push(rebaseTransactionIndex(record));
      }
    }
  }

  const stepResults = caseResults.filter(
    (result) => result.location?.stepIdx === stepIndex,
  );
  for (const finding of httpTestResultToRuleFindings(stepResults)) {
    const record = ruleFindingToFindingRecord(finding);
    if (record) {
      detailRecords.push(rebaseTransactionIndex(record));
    }
  }

  // A violation with no failure detail still needs a visible marker; when detail
  // findings already convey the failure, don't add a duplicate generic marker.
  const violation = stepPlacements.find(
    ({ result }) => result.violation !== undefined,
  )?.result.violation;
  const hasFailureDetail = detailRecords.some(
    (f) => f.kind === 'assertion-failure' || f.kind === 'rule-violation',
  );

  const findings: FindingRecord[] = [];
  if (violation !== undefined && !hasFailureDetail) {
    findings.push(ruleViolationToStepFinding(violation, rule));
  }
  findings.push(...detailRecords);

  return createTestStep({
    name: `Step ${stepIndex + 1}`,
    location,
    findings,
    httpTransactions:
      httpTransactions.length > 0 ? httpTransactions : undefined,
  });
}

function stepToLocation(step: HttpTestCaseStep): Location {
  if (isSingleHttpTestCaseStep(step)) {
    return {
      type: 'thymianFormat',
      elementType: 'edge',
      elementId: step.source.transactionId,
      pointer: '',
    };
  }
  if (isGroupedHttpTestCaseStep(step)) {
    return { type: 'custom', value: step.source.key };
  }
  if (isCustomHttpTestCaseStep(step)) {
    const src = step.source;
    const value =
      src === null || typeof src !== 'object'
        ? String(src)
        : JSON.stringify(src);
    return { type: 'custom', value };
  }
  return { type: 'custom', value: 'unknown' };
}

/** Signals gathered from a test case's rule results that drive its status. */
interface TestCaseSignals {
  /** A rule reported a violation somewhere in this case. */
  hasViolation: boolean;
  /** First violation message, if any. */
  violationReason?: string;
  /** A `rule-skip` finding was reported for this case. */
  hasRuleSkip: boolean;
  /** First rule-skip reason, if any. */
  ruleSkipReason?: string;
}

/**
 * Map a test case to an {@link ExecutionStatus}. The execution status reflects
 * whether the *rule* found something, NOT the raw HTTP test-case outcome:
 * - a rule violation ⇒ `failed` (the only path to `failed`);
 * - otherwise a `rule-skip` signal, a skipped case, or a case that could not be
 *   executed (HTTP-level failure without a violation) ⇒ `skipped`;
 * - otherwise ⇒ `passed`.
 */
function computeTestCaseStatus(
  testCase: HttpTestCase,
  signals: TestCaseSignals,
): ExecutionStatus {
  const durationMilliseconds =
    testCase.end !== undefined ? testCase.end - testCase.start : undefined;

  if (signals.hasViolation) {
    return {
      kind: 'failed',
      ...(signals.violationReason ? { reason: signals.violationReason } : {}),
      ...(durationMilliseconds !== undefined ? { durationMilliseconds } : {}),
    };
  }

  if (signals.hasRuleSkip) {
    return {
      kind: 'skipped',
      ...(signals.ruleSkipReason ? { reason: signals.ruleSkipReason } : {}),
    };
  }

  if (testCase.status === 'skipped' || testCase.status === 'failed') {
    return {
      kind: 'skipped',
      ...(testCase.reason ? { reason: testCase.reason } : {}),
    };
  }

  return {
    kind: 'passed',
    ...(durationMilliseconds !== undefined ? { durationMilliseconds } : {}),
  };
}

/**
 * Combine the placements the context recorded with placements synthesized for
 * rule results that reference an executed transaction but weren't placed.
 *
 * A rule may collect violations from a `.transactions()` inspection callback and
 * return them directly (rather than failing the test case), so the context never
 * records a placement for them. Each such result still carries the transaction's
 * edge id, so we match it back to the test case/step that ran that transaction —
 * letting it render on the right step instead of falling through to the unplaced
 * fallback.
 */
function resolvePlacements(
  testResult: HttpTestResult,
  contextPlacements: RuleFnResultPlacement[],
  ruleFnResult: RuleFnResult[],
  alreadyConsumed: ReadonlySet<RuleFnResult>,
): RuleFnResultPlacement[] {
  const positionByEdgeId = new Map<
    string,
    { testCaseIndex: number; stepIndex: number }
  >();
  testResult.cases.forEach((testCase, testCaseIndex) => {
    testCase.steps.forEach((step, stepIndex) => {
      for (const transaction of step.transactions) {
        const id = transaction.source?.transactionId;
        if (id !== undefined && !positionByEdgeId.has(id)) {
          positionByEdgeId.set(id, { testCaseIndex, stepIndex });
        }
      }
    });
  });

  const placed = new Set(
    contextPlacements.map((placement) => placement.result),
  );
  const synthesized: RuleFnResultPlacement[] = [];
  for (const result of ruleFnResult) {
    if (placed.has(result) || alreadyConsumed.has(result)) {
      continue;
    }
    const { location } = result;
    const edgeId =
      typeof location !== 'string' && location.elementType === 'edge'
        ? location.elementId
        : undefined;
    const position =
      edgeId !== undefined ? positionByEdgeId.get(edgeId) : undefined;
    if (position !== undefined) {
      synthesized.push({ result, ...position });
    }
  }

  return [...contextPlacements, ...synthesized];
}

// exported for testing
export function createRuns(
  pluginName: string,
  ruleResults: RunRulesResult<HttpTesterRuleDiagnostics>,
  rules: Rule[] = [],
  thymianFormat: ThymianFormat,
  logger: Logger,
  thymianFormatVersion?: string,
): ToolRun[] {
  const ruleMap = new Map(rules.map((r) => [r.meta.name, r]));
  const executions: TestCaseExecution[] = [];

  for (const [ruleName, { ruleFnResult, diagnostics }] of Object.entries(
    ruleResults,
  )) {
    const rule = ruleMap.get(ruleName);
    if (!rule) {
      continue;
    }

    const consumedResults = new Set<RuleFnResult>();

    if (diagnostics) {
      for (const { testResult, placements } of diagnostics) {
        const resolvedPlacements = resolvePlacements(
          testResult,
          placements,
          ruleFnResult,
          consumedResults,
        );
        testResult.cases.forEach((testCase, testCaseIndex) => {
          const casePlacements = resolvedPlacements.filter(
            (p) => p.testCaseIndex === testCaseIndex,
          );

          // Case-level placements (no step index) no longer become findings —
          // the case outcome lives on `status`. Accumulate violation/rule-skip
          // signals across every placement (case- and step-level) to derive it.
          const signals: TestCaseSignals = {
            hasViolation: false,
            hasRuleSkip: false,
          };
          for (const { result } of casePlacements) {
            consumedResults.add(result);
            if (result.violation !== undefined) {
              signals.hasViolation = true;
              if (signals.violationReason === undefined) {
                signals.violationReason = result.violation.message;
              }
            }
            for (const finding of result.findings) {
              if (finding.kind === 'rule-skip') {
                signals.hasRuleSkip = true;
                if (signals.ruleSkipReason === undefined) {
                  signals.ruleSkipReason = finding.reason ?? finding.message;
                }
              }
            }
          }

          const steps = testCase.steps.map((step, stepIndex) =>
            buildTestStep(
              step,
              stepIndex,
              casePlacements,
              testCase.results,
              rule,
              stepToLocation(step),
            ),
          );

          executions.push(
            createTestCaseExecution({
              name: testCase.name,
              ruleId: ruleName,
              status: computeTestCaseStatus(testCase, signals),
              steps,
            }),
          );
        });
      }
    }

    // Fallback: a result that could not be attached to any executed test
    // case/step (it references no known transaction, e.g. a rule reporting at a
    // non-edge location). Emit a standalone test case (folding any diagnostic
    // text into the reason) and warn, so the result is still surfaced.
    for (const result of ruleFnResult) {
      if (consumedResults.has(result)) {
        continue;
      }

      const resolvedLocation = resolveViolationLocation(
        result.location,
        thymianFormat,
        ruleName,
      );

      const reasonParts: string[] = [];
      if (result.violation?.message) {
        reasonParts.push(result.violation.message);
      }
      for (const finding of result.findings) {
        if (finding.title) {
          reasonParts.push(finding.title);
        }
      }
      const reason = reasonParts.join('; ') || undefined;

      // A violation ⇒ failed; anything else couldn't be placed/executed ⇒ skipped.
      const status: ExecutionStatus =
        result.violation !== undefined
          ? { kind: 'failed', ...(reason ? { reason } : {}) }
          : { kind: 'skipped', ...(reason ? { reason } : {}) };

      logger.warn(
        `${pluginName}: rule "${ruleName}" produced an unplaced result at ${resolvedLocation.heading}; emitting a ${status.kind} test case.`,
      );

      executions.push(
        createTestCaseExecution({
          name: resolvedLocation.heading,
          ruleId: ruleName,
          status,
          steps: [],
        }),
      );
    }
  }

  const ruleDescriptors = rulesToRuleDescriptors(rules, (r) => r.testRule);

  return [
    createToolRun({
      tool: { name: pluginName },
      runType: 'test',
      executions,
      rules: ruleDescriptors.length > 0 ? ruleDescriptors : undefined,
      // Reuse the hash carried by the serialized input format when provided,
      // instead of recomputing it here.
      thymianFormatVersion: thymianFormatVersion ?? thymianFormat.toHash(),
    }),
  ];
}

export function createHttpTesterPlugin(
  pluginName = '@thymian/plugin-http-tester',
): ThymianPlugin {
  return {
    name: pluginName,
    version: '0.x',
    actions: {
      listensOn: ['core.test'],
    },
    async plugin(emitter, logger) {
      emitter.onAction(
        'core.test',
        async ({ format, rules = [], rulesConfig = {}, targetUrl }, ctx) => {
          const thymianFormat = ThymianFormat.import(format);
          let normalizedOrigin: string | undefined;

          if (targetUrl != null) {
            try {
              const url = new URL(targetUrl);
              normalizedOrigin = url.origin;
            } catch (error) {
              throw new ThymianBaseError(
                `Invalid value for --target-url / config key "targetUrl" ("${targetUrl}"): ${(error as Error).message}`,
                {
                  suggestions: [
                    'Provide a valid URL including the protocol (e.g., "http://localhost:3000").',
                  ],
                },
              );
            }
          }

          const context = createContextFromEmitter(
            thymianFormat,
            logger,
            emitter,
            normalizedOrigin,
          );

          const adapter: RuleRunnerAdapter<
            HttpTestApiContext,
            HttpTesterRuleDiagnostics
          > = {
            errorName: 'TestLinterError',
            mode: 'test',
            getRuleFn: (rule) => rule.testRule,
            createContext: (
              rule: Rule,
              options: SingleRuleConfiguration | undefined,
            ) =>
              new HttpTestApiContext(
                rule.meta.name,
                context,
                (options ?? {}).skipOrigins,
              ),
          };

          const ruleResults = await runRules(
            logger,
            rules,
            thymianFormat,
            rulesConfig,
            adapter,
          );

          ctx.reply(
            createRuns(
              pluginName,
              ruleResults,
              rules,
              thymianFormat,
              logger,
              format.attributes.hash,
            ),
          );
        },
      );
    },
  };
}

export const httpTesterPlugin = createHttpTesterPlugin();

export default httpTesterPlugin;
