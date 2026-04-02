import {
  type Rule,
  type RuleRunnerAdapter,
  runRules,
  type SingleRuleConfiguration,
  ThymianBaseError,
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
        async ({ format, rules = [], rulesConfig = {}, targetUrl }, ctx) => {
          const thymianFormat = ThymianFormat.import(format);
          const reportFn = (report: ThymianReport) =>
            emitter.emit('core.report', report);

          let normalizedOrigin: string | undefined;

          if (targetUrl != null) {
            try {
              const url = new URL(targetUrl);
              normalizedOrigin = url.origin;
            } catch (error) {
              throw new ThymianBaseError(
                `Invalid targetUrl "${targetUrl}": ${(error as Error).message}`,
                {
                  suggestions: [
                    'Provide a valid URL including the protocol (e.g., "http://localhost:3000").',
                  ],
                },
              );
            }
          }

          const context = createContext(
            thymianFormat,
            logger,
            emitter,
            normalizedOrigin,
          );

          const adapter: RuleRunnerAdapter<HttpTestApiContext> = {
            errorName: 'TestLinterError',
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
                pluginName,
              ),
          };

          const { violations, statistics } = await runRules(
            logger,
            rules,
            thymianFormat,
            rulesConfig,
            adapter,
          );

          ctx.reply({
            source: pluginName,
            status: violations.length === 0 ? 'success' : 'failed',
            violations,
            statistics,
          });
        },
      );
    },
  };
}

export const httpTesterPlugin = createHttpTesterPlugin();

export default httpTesterPlugin;
