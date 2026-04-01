import {
  type Rule,
  type RuleRunnerAdapter,
  type RulesConfiguration,
  runRules,
  type SerializedThymianFormat,
  type SingleRuleConfiguration,
  ThymianFormat,
  type ThymianPlugin,
  type ThymianReport,
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
        reports: ThymianReport[];
        valid: boolean;
      };
    };
  }
}

export type HttpLinterPluginOptions = Record<string, never>;

function createStaticLinterAdapter(
  pluginName: string,
  logger: import('@thymian/core').Logger,
  reportFn: (report: ThymianReport) => void,
  format: ThymianFormat,
  rulesConfig: RulesConfiguration,
): RuleRunnerAdapter<StaticApiContext> {
  return {
    errorName: 'StaticLinterError',
    category: 'Static Checks',
    producer: pluginName,
    mode: 'static',
    getRuleFn: (rule: Rule) => rule.lintRule,
    createContext: (
      _rule: Rule,
      options: SingleRuleConfiguration | undefined,
    ) =>
      new StaticApiContext(
        format,
        logger,
        reportFn,
        (options ?? {}).skipOrigins,
      ),
  };
}

export function createHttpLinterPlugin(
  pluginName = '@thymian/http-linter',
): ThymianPlugin<HttpLinterPluginOptions> {
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
          const reports: ThymianReport[] = [];
          const reportFn = (report: ThymianReport) => reports.push(report);

          const { valid, violations } = await runRules(
            logger,
            rules,
            reportFn,
            thymianFormat,
            rulesConfig,
            createStaticLinterAdapter(
              pluginName,
              logger,
              reportFn,
              thymianFormat,
              rulesConfig,
            ),
          );

          ctx.reply({
            status: valid ? 'success' : 'failed',
            reports,
            violations,
          });
        },
      );

      emitter.onAction(
        'http-linter.lint-static',
        async ({ format, rules = [], rulesConfig = {} }, ctx) => {
          const thymianFormat = ThymianFormat.import(format);
          const reports: ThymianReport[] = [];
          const reportFn = (report: ThymianReport) => reports.push(report);

          const { valid } = await runRules(
            logger,
            rules,
            reportFn,
            thymianFormat,
            rulesConfig,
            createStaticLinterAdapter(
              pluginName,
              logger,
              reportFn,
              thymianFormat,
              rulesConfig,
            ),
          );

          ctx.reply({
            reports,
            valid,
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
