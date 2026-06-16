import {
  createToolRun,
  type EvaluatedRuleViolation,
  executionsFromViolations,
  type Rule,
  type RuleRunnerAdapter,
  type RulesConfiguration,
  rulesToRuleDescriptors,
  runRules,
  runRulesResultToViolations,
  type SerializedThymianFormat,
  type SingleRuleConfiguration,
  ThymianFormat,
  type ThymianPlugin,
  type ToolRun,
} from '@thymian/core';

import { StaticApiContext } from './static-api-context.js';

export { StaticApiContext } from './static-api-context.js';

declare module '@thymian/core' {
  interface ThymianActions {
    'http-linter.load-rules': {
      event: { rules: string[] };
      response: void;
    };

    'http-linter.rules': {
      event: never;
      response: Rule[];
    };

    'http-linter.lint-static': {
      event: {
        format: SerializedThymianFormat;
        rules?: Rule[];
        rulesConfig?: RulesConfiguration;
      };
      response: {
        runs: ToolRun[];
        violations: EvaluatedRuleViolation[];
        valid: boolean;
      };
    };
  }
}

function createStaticLinterAdapter(
  logger: import('@thymian/core').Logger,
  format: ThymianFormat,
  rulesConfig: RulesConfiguration,
): RuleRunnerAdapter<StaticApiContext> {
  return {
    errorName: 'StaticLinterError',
    mode: 'static',
    getRuleFn: (rule: Rule) => rule.lintRule,
    createContext: (
      _rule: Rule,
      options: SingleRuleConfiguration | undefined,
    ) => new StaticApiContext(format, logger, (options ?? {}).skipOrigins),
  };
}

function createRuns(
  pluginName: string,
  format: ThymianFormat,
  violations: EvaluatedRuleViolation[],
  rules: Rule[] = [],
): ToolRun[] {
  const executions = executionsFromViolations(violations, format);

  if (executions.length === 0) {
    return [];
  }

  const ruleDescriptors = rulesToRuleDescriptors(rules, (r) => r.lintRule);

  return [
    createToolRun({
      tool: { name: pluginName },
      runType: 'lint',
      executions,
      rules: ruleDescriptors.length > 0 ? ruleDescriptors : undefined,
    }),
  ];
}

export function createHttpLinterPlugin(
  pluginName = '@thymian/plugin-http-linter',
): ThymianPlugin {
  return {
    name: pluginName,
    version: '0.x',
    actions: {
      listensOn: ['core.lint'],
    },
    async plugin(emitter, logger) {
      emitter.onAction(
        'core.lint',
        async ({ format, rules = [], rulesConfig = {} }, ctx) => {
          const thymianFormat = ThymianFormat.import(format);

          const ruleResults = await runRules(
            logger,
            rules,
            thymianFormat,
            rulesConfig,
            createStaticLinterAdapter(logger, thymianFormat, rulesConfig),
          );
          const violations = runRulesResultToViolations(ruleResults, rules);

          ctx.reply(createRuns(pluginName, thymianFormat, violations, rules));
        },
      );

      emitter.onAction(
        'http-linter.lint-static',
        async ({ format, rules = [], rulesConfig = {} }, ctx) => {
          const thymianFormat = ThymianFormat.import(format);

          const ruleResults = await runRules(
            logger,
            rules,
            thymianFormat,
            rulesConfig,
            createStaticLinterAdapter(logger, thymianFormat, rulesConfig),
          );
          const violations = runRulesResultToViolations(ruleResults, rules);

          ctx.reply({
            runs: createRuns(pluginName, thymianFormat, violations, rules),
            violations,
            valid: violations.length === 0,
          });
        },
      );

      emitter.onAction('http-linter.load-rules', async (_, ctx) => {
        ctx.reply();
      });

      emitter.onAction('http-linter.rules', (_, ctx) => {
        ctx.reply([]);
      });
    },
  };
}

export const httpLinterPlugin = createHttpLinterPlugin();

export default httpLinterPlugin;
