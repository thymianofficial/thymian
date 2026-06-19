import { randomUUID } from 'node:crypto';

import {
  createContextFromEmitter,
  createExecution,
  createToolRun,
  type Execution,
  type FindingRecord,
  type HttpTestCase,
  type HttpTestCaseStep,
  resolveViolationLocation,
  type Rule,
  ruleFindingToFindingRecord,
  type RuleRunnerAdapter,
  rulesToRuleDescriptors,
  type RuleViolationFinding,
  runRules,
  type RunRulesResult,
  type Severity,
  type SingleRuleConfiguration,
  ThymianBaseError,
  ThymianFormat,
  type ThymianPlugin,
  type ToolRun,
} from '@thymian/core';
import { find } from 'rxjs';

import {
  HttpTestApiContext,
  type HttpTesterRuleDiagnostics,
} from './http-test-api-context.js';

export {
  HttpTestApiContext,
  type HttpTesterRuleDiagnostics,
} from './http-test-api-context.js';

function buildStepExecution(
  step: HttpTestCaseStep,
  stepIndex: number,
  violationByTxId: Map<string, string>,
  rule: Rule,
): Execution {
  const findings: FindingRecord[] = [];

  for (const transaction of step.transactions) {
    const txId = transaction.source?.transactionId;
    if (txId && violationByTxId.has(txId)) {
      const message = violationByTxId.get(txId)!;
      findings.push({
        id: randomUUID(),
        kind: 'rule-violation',
        ruleId: rule.meta.name,
        title:
          message ||
          (rule.meta.summary ?? rule.meta.description ?? rule.meta.name),
        severity: rule.meta.severity as Exclude<
          typeof rule.meta.severity,
          'off'
        >,
        ...(message ? { message: { text: message } } : {}),
      } satisfies FindingRecord);
      violationByTxId.delete(txId);
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
    location: { type: 'custom', value: `step-${stepIndex + 1}` },
    findings,
    httpTransactions:
      httpTransactions.length > 0 ? httpTransactions : undefined,
  });
}

function buildTestCaseExecution(
  testCase: HttpTestCase,
  violationByTxId: Map<string, string>,
  rule: Rule,
): Execution {
  const durationMilliseconds =
    testCase.end !== undefined ? testCase.end - testCase.start : undefined;

  const stepChildren = testCase.steps.map((step, i) =>
    buildStepExecution(step, i, violationByTxId, rule),
  );

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
    findings: [testCaseFinding],
    children: stepChildren.length > 0 ? stepChildren : undefined,
  });
}

function createRuns(
  pluginName: string,
  ruleResults: RunRulesResult<HttpTesterRuleDiagnostics>,
  rules: Rule[] = [],
  thymianFormat: ThymianFormat,
): ToolRun[] {
  const ruleMap = new Map(rules.map((r) => [r.meta.name, r]));
  const ruleExecutions: Execution[] = [];

  // TODO: Skip diagnostics data for now. We currently lack a mapping between recorded HTTP test cases and the triggered rule violations. This information is also missing in the reporting data.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const [ruleName, { ruleFnResult, diagnostics }] of Object.entries(
    ruleResults,
  )) {
    const rule = ruleMap.get(ruleName);
    if (!rule) {
      continue;
    }

    const ruleExecution = createExecution({
      location: { type: 'custom', value: ruleName },
      findings: [],
    });

    for (const { location, violation, findings } of ruleFnResult) {
      const resolvedLocation = resolveViolationLocation(
        location,
        thymianFormat,
        ruleName,
      );

      const singleRuleExecution = createExecution({
        location: resolvedLocation.location,
        findings: [],
        name: resolvedLocation.heading,
      });

      if (violation) {
        const ruleViolationFinding: RuleViolationFinding = {
          kind: 'rule-violation',
          id: randomUUID(),
          title:
            violation.message ??
            rule.meta.summary ??
            rule.meta.description ??
            rule.meta.name,
          ruleId: rule.meta.name,
          severity: rule.meta.severity as Severity, // rule severity won't be "off"
        };

        if (rule.meta.explanation) {
          ruleViolationFinding.message = { text: rule.meta.explanation };
        }

        singleRuleExecution.findings.push(ruleViolationFinding);
      }

      for (const finding of findings) {
        singleRuleExecution.findings.push(ruleFindingToFindingRecord(finding));
      }

      ruleExecution.children?.push(singleRuleExecution);
    }

    ruleExecutions.push(ruleExecution);
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
