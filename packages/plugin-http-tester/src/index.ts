import { randomUUID } from 'node:crypto';

import {
  createContextFromEmitter,
  createTestCaseExecution,
  createTestStep,
  createToolRun,
  type ExecutionStatus,
  type FindingRecord,
  type HttpTestCase,
  type HttpTestCaseStep,
  isCustomHttpTestCaseStep,
  isGroupedHttpTestCaseStep,
  isSingleHttpTestCaseStep,
  type Location,
  type Logger,
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

// stepPlacements must be pre-filtered to this step (testCaseIndex + stepIndex match).
function buildTestStep(
  step: HttpTestCaseStep,
  stepIndex: number,
  stepPlacements: RuleFnResultPlacement[],
  rule: Rule,
  location: Location,
): TestStep {
  const findings: FindingRecord[] = [];

  for (const { result } of stepPlacements) {
    if (result.violation !== undefined) {
      findings.push(ruleViolationToStepFinding(result.violation, rule));
    }
    for (const finding of result.findings) {
      const record = ruleFindingToFindingRecord(finding);
      if (record) {
        findings.push(record);
      }
    }
  }

  const httpTransactions = step.transactions
    .filter((t) => t.request !== undefined && t.response !== undefined)
    .map((t) => ({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      request: t.request!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      response: t.response!,
    }));

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

// exported for testing
export function createRuns(
  pluginName: string,
  ruleResults: RunRulesResult<HttpTesterRuleDiagnostics>,
  rules: Rule[] = [],
  thymianFormat: ThymianFormat,
  logger: Logger,
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
        testResult.cases.forEach((testCase, testCaseIndex) => {
          // Case-level placements (no step index) no longer become findings —
          // the case outcome lives on `status`. Accumulate violation/rule-skip
          // signals across every placement (case- and step-level) to derive it.
          const signals: TestCaseSignals = {
            hasViolation: false,
            hasRuleSkip: false,
          };
          const noteResult = (result: RuleFnResult): void => {
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
          };

          for (const { result } of placements.filter(
            (p) =>
              p.testCaseIndex === testCaseIndex && p.stepIndex === undefined,
          )) {
            noteResult(result);
          }

          const steps = testCase.steps.map((step, stepIndex) => {
            const stepPlacements = placements.filter(
              (p) =>
                p.testCaseIndex === testCaseIndex && p.stepIndex === stepIndex,
            );
            for (const { result } of stepPlacements) {
              noteResult(result);
            }

            return buildTestStep(
              step,
              stepIndex,
              stepPlacements,
              rule,
              stepToLocation(step),
            );
          });

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

    // Fallback: results not placed by diagnostics have no test-case/step slot in
    // the strict model. This path is verified unreachable in production; emit a
    // failed test case (folding any diagnostic text into the reason) and warn.
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
      thymianFormatVersion: thymianFormat.toHash(),
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
            createRuns(pluginName, ruleResults, rules, thymianFormat, logger),
          );
        },
      );
    },
  };
}

export const httpTesterPlugin = createHttpTesterPlugin();

export default httpTesterPlugin;
