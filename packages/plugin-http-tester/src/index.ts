import {
  createContextFromEmitter,
  createExecution,
  createToolRun,
  type EvaluatedRuleViolation,
  executionsFromViolations,
  mergeRuleFindings,
  type Rule,
  type RuleFinding,
  ruleFindingsToFindingRecords,
  type RuleRunnerAdapter,
  rulesToRuleDescriptors,
  runRules,
  type SingleRuleConfiguration,
  ThymianBaseError,
  ThymianFormat,
  type ThymianPlugin,
  type ToolRun,
} from '@thymian/core';

import {
  HttpTestApiContext,
  type HttpTesterRuleDiagnostics,
} from './http-test-api-context.js';

export {
  HttpTestApiContext,
  type HttpTesterRuleDiagnostics,
} from './http-test-api-context.js';

function diagnosticsToRuleFindings(
  diagnostics: HttpTesterRuleDiagnostics,
): RuleFinding[] {
  return [
    ...diagnostics.findings,
    ...diagnostics.skippedCases.map((testCase) => ({
      kind: 'test-case-skip',
      title: testCase.name,
      message: testCase.reason,
      severity: 'info' as const,
      reason: testCase.reason,
    })),
    ...diagnostics.failedCases.map((testCase) => ({
      kind: 'test-case-fail',
      title: testCase.name,
      message: testCase.reason,
      severity: 'error' as const,
    })),
  ];
}

function createRuns(
  pluginName: string,
  format: ThymianFormat,
  violations: EvaluatedRuleViolation[],
  findingsByRule: Partial<Record<string, RuleFinding[]>>,
  diagnosticsByRule: Partial<Record<string, HttpTesterRuleDiagnostics>>,
  rules: Rule[] = [],
): ToolRun[] {
  const executions = executionsFromViolations(violations, format);
  const children = [
    ...Object.entries(findingsByRule).map(([ruleName, findings]) =>
      createExecution({
        name: ruleName,
        location: { type: 'custom', value: ruleName },
        findings: ruleFindingsToFindingRecords(findings ?? [], ruleName),
      }),
    ),
    ...Object.entries(diagnosticsByRule).map(([ruleName, diagnostics]) =>
      createExecution({
        name: ruleName,
        location: { type: 'custom', value: ruleName },
        findings: diagnostics
          ? ruleFindingsToFindingRecords(
              diagnosticsToRuleFindings(diagnostics),
              ruleName,
            )
          : [],
      }),
    ),
  ];

  const mergedFindings = mergeRuleFindings(findingsByRule);

  if (
    executions.length === 0 &&
    mergedFindings.length === 0 &&
    children.length === 0
  ) {
    return [];
  }

  const rootExecution =
    executions[0] ??
    createExecution({
      location: { type: 'custom', value: 'test' },
      findings: [],
    });

  if (mergedFindings.length > 0) {
    rootExecution.findings.push(...mergedFindings);
  }

  if (children.length > 0) {
    rootExecution.children = [...(rootExecution.children ?? []), ...children];
  }

  const finalExecutions = executions.length > 0 ? executions : [rootExecution];
  if (executions.length > 0 && rootExecution !== executions[0]) {
    finalExecutions.unshift(rootExecution);
  }

  const ruleDescriptors = rulesToRuleDescriptors(rules, (r) => r.testRule);

  return [
    createToolRun({
      tool: { name: pluginName },
      runType: 'test',
      executions: finalExecutions,
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

          const { violations, diagnosticsByRule, findingsByRule } =
            await runRules(logger, rules, thymianFormat, rulesConfig, adapter);

          ctx.reply(
            createRuns(
              pluginName,
              thymianFormat,
              violations,
              findingsByRule,
              diagnosticsByRule,
              rules,
            ),
          );
        },
      );
    },
  };
}

export const httpTesterPlugin = createHttpTesterPlugin();

export default httpTesterPlugin;
