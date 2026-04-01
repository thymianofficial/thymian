import {
  type Rule,
  type RuleRunnerAdapter,
  runRules,
  type SingleRuleConfiguration,
  ThymianFormat,
  type ThymianPlugin,
  type ThymianReport,
} from '@thymian/core';

import { createContext } from './create-context.js';
import { HttpTestApiContext } from './http-test-api-context.js';

export { createContext } from './create-context.js';
export { HttpTestApiContext } from './http-test-api-context.js';

export type HttpTesterPluginOptions = Record<string, never>;

export function createHttpTesterPlugin(
  pluginName = '@thymian/http-tester',
): ThymianPlugin<HttpTesterPluginOptions> {
  return {
    name: pluginName,
    version: '0.x',
    actions: {
      listensOn: ['core.test'],
    },
    async plugin(emitter, logger) {
      emitter.onAction(
        'core.test',
        async ({ format, rules = [], rulesConfig = {} }, ctx) => {
          const thymianFormat = ThymianFormat.import(format);
          const reports: ThymianReport[] = [];
          const reportFn = (report: ThymianReport) => reports.push(report);

          const context = createContext(thymianFormat, logger, emitter);

          const adapter: RuleRunnerAdapter<HttpTestApiContext> = {
            errorName: 'TestLinterError',
            category: 'HTTP Tests',
            producer: pluginName,
            mode: 'test',
            getRuleFn: (rule: Rule) => rule.testRule,
            createContext: (
              rule: Rule,
              options: SingleRuleConfiguration | undefined,
            ) =>
              new HttpTestApiContext(
                rule.meta.name,
                context,
                reportFn,
                (options ?? {}).skipOrigins,
              ),
          };

          const { valid, violations } = await runRules(
            logger,
            rules,
            reportFn,
            thymianFormat,
            rulesConfig,
            adapter,
          );

          ctx.reply({
            status: valid ? 'success' : 'failed',
            reports,
            violations,
          });
        },
      );
    },
  };
}

export const httpTesterPlugin = createHttpTesterPlugin();

export default httpTesterPlugin;
