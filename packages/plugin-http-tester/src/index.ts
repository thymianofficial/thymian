import { randomUUID } from 'node:crypto';

import {
  createContextFromEmitter,
  createExecution,
  createToolRun,
  type Execution,
  type FindingRecord,
  type HttpTestCase,
  type HttpTestCaseStep,
  isCustomHttpTestCaseStep,
  isGroupedHttpTestCaseStep,
  isSingleHttpTestCaseStep,
  type Location,
  resolveViolationLocation,
  type Rule,
  ruleFindingToFindingRecord,
  type RuleFnResult,
  type RuleRunnerAdapter,
  rulesToRuleDescriptors,
  runRules,
  type RunRulesResult,
  type SingleRuleConfiguration,
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

function ruleViolationToFindingRecord(
  violation: NonNullable<RuleFnResult['violation']>,
  rule: Rule,
): FindingRecord {
  const message = violation.message;
  return {
    id: randomUUID(),
    kind: 'rule-violation',
    ruleId: rule.meta.name,
    title:
      message || (rule.meta.summary ?? rule.meta.description ?? rule.meta.name),
    severity: rule.meta.severity as Exclude<typeof rule.meta.severity, 'off'>,
    ...(message
      ? { message: { text: message } }
      : rule.meta.explanation
        ? { message: { text: rule.meta.explanation } }
        : {}),
  } satisfies FindingRecord;
}

// stepPlacements must be pre-filtered to this step (testCaseIndex + stepIndex match).
function buildStepExecution(
  step: HttpTestCaseStep,
  stepIndex: number,
  stepPlacements: RuleFnResultPlacement[],
  rule: Rule,
  location: Location,
): Execution {
  const findings: FindingRecord[] = [];

  for (const { result } of stepPlacements) {
    if (result.violation !== undefined) {
      findings.push(ruleViolationToFindingRecord(result.violation, rule));
    }
    for (const finding of result.findings) {
      findings.push(ruleFindingToFindingRecord(finding));
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

  return createExecution({
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

function buildTestCaseExecution(
  testCase: HttpTestCase,
  extraFindings: FindingRecord[],
  children: Execution[],
): Execution {
  const durationMilliseconds =
    testCase.end !== undefined ? testCase.end - testCase.start : undefined;

  let testCaseFinding: FindingRecord;

  if (testCase.status === 'skipped') {
    testCaseFinding = {
      id: randomUUID(),
      kind: 'test-case-skip',
      title: testCase.name,
      severity: 'info',
      reason: testCase.reason ?? '',
      ...(testCase.reason ? { message: { text: testCase.reason } } : {}),
    } satisfies FindingRecord;
  } else if (testCase.status === 'failed') {
    testCaseFinding = {
      id: randomUUID(),
      kind: 'test-case-fail',
      title: testCase.name,
      severity: 'error',
      ...(testCase.reason ? { message: { text: testCase.reason } } : {}),
      ...(durationMilliseconds !== undefined ? { durationMilliseconds } : {}),
    } satisfies FindingRecord;
  } else {
    testCaseFinding = {
      id: randomUUID(),
      kind: 'test-case-pass',
      title: testCase.name,
      severity: 'info',
      ...(durationMilliseconds !== undefined ? { durationMilliseconds } : {}),
    } satisfies FindingRecord;
  }

  return createExecution({
    name: testCase.name,
    location: { type: 'custom', value: testCase.name },
    findings: [testCaseFinding, ...extraFindings],
    children,
  });
}

// exported for testing
export function createRuns(
  pluginName: string,
  ruleResults: RunRulesResult<HttpTesterRuleDiagnostics>,
  rules: Rule[] = [],
  thymianFormat: ThymianFormat,
): ToolRun[] {
  const ruleMap = new Map(rules.map((r) => [r.meta.name, r]));
  const ruleExecutions: Execution[] = [];

  for (const [ruleName, { ruleFnResult, diagnostics }] of Object.entries(
    ruleResults,
  )) {
    const rule = ruleMap.get(ruleName);
    if (!rule) {
      continue;
    }

    const consumedResults = new Set<RuleFnResult>();
    const ruleChildren: Execution[] = [];

    if (diagnostics) {
      for (const { testResult, placements } of diagnostics) {
        testResult.cases.forEach((testCase, testCaseIndex) => {
          const testCasePlacements = placements.filter(
            (p) =>
              p.testCaseIndex === testCaseIndex && p.stepIndex === undefined,
          );
          const testCaseFindings: FindingRecord[] = [];
          for (const { result } of testCasePlacements) {
            consumedResults.add(result);
            if (result.violation !== undefined) {
              testCaseFindings.push(
                ruleViolationToFindingRecord(result.violation, rule),
              );
            }
            for (const finding of result.findings) {
              testCaseFindings.push(ruleFindingToFindingRecord(finding));
            }
          }

          const stepExecutions = testCase.steps.map((step, stepIndex) => {
            const stepPlacements = placements.filter(
              (p) =>
                p.testCaseIndex === testCaseIndex && p.stepIndex === stepIndex,
            );
            for (const { result } of stepPlacements) {
              consumedResults.add(result);
            }

            return buildStepExecution(
              step,
              stepIndex,
              stepPlacements,
              rule,
              stepToLocation(step),
            );
          });

          ruleChildren.push(
            buildTestCaseExecution(testCase, testCaseFindings, stepExecutions),
          );
        });
      }
    }

    // Fallback: render results not placed by diagnostics using location-based layout
    for (const result of ruleFnResult) {
      if (consumedResults.has(result)) {
        continue;
      }

      const resolvedLocation = resolveViolationLocation(
        result.location,
        thymianFormat,
        ruleName,
      );

      const fallbackFindings: FindingRecord[] = [];

      if (result.violation) {
        fallbackFindings.push(
          ruleViolationToFindingRecord(result.violation, rule),
        );
      }

      for (const finding of result.findings) {
        fallbackFindings.push(ruleFindingToFindingRecord(finding));
      }

      ruleChildren.push(
        createExecution({
          location: resolvedLocation.location,
          findings: fallbackFindings,
          name: resolvedLocation.heading,
        }),
      );
    }

    ruleExecutions.push(
      createExecution({
        location: { type: 'custom', value: ruleName },
        findings: [],
        children: ruleChildren,
      }),
    );
  }

  const ruleDescriptors = rulesToRuleDescriptors(rules, (r) => r.testRule);

  return [
    createToolRun({
      tool: { name: pluginName },
      runType: 'test',
      executions: ruleExecutions,
      rules: ruleDescriptors.length > 0 ? ruleDescriptors : undefined,
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

          ctx.reply(createRuns(pluginName, ruleResults, rules, thymianFormat));
        },
      );
    },
  };
}

export const httpTesterPlugin = createHttpTesterPlugin();

export default httpTesterPlugin;
