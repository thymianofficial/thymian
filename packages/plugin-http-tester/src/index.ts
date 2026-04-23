import {
  type Rule,
  type RuleRunnerAdapter,
  runRules,
  type SingleRuleConfiguration,
  ThymianBaseError,
  ThymianFormat,
  type ThymianPlugin,
} from '@thymian/core';

import { createContext } from './create-context.js';
import { createHttpTestDiagnosticsReport } from './create-diagnostics-report.js';
import {
  HttpTestApiContext,
  type HttpTesterRuleDiagnostics,
} from './http-test-api-context.js';

export { createContext } from './create-context.js';
export {
  HttpTestApiContext,
  type HttpTesterRuleDiagnostics,
} from './http-test-api-context.js';

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

          const context = createContext(
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

          const { violations, statistics, diagnosticsByRule } = await runRules(
            logger,
            rules,
            thymianFormat,
            rulesConfig,
            adapter,
          );

          const report = createHttpTestDiagnosticsReport(
            pluginName,
            diagnosticsByRule,
          );

          if (report) {
            emitter.emit('core.report', report);
          }

          ctx.reply({
            source: pluginName,
            status: violations.length === 0 ? 'success' : 'failed',
            violations,
            statistics,
            metadata: {
              diagnosticsByRule,
            },
          });
        },
      );
    },
  };
}

export const httpTesterPlugin = createHttpTesterPlugin();

export default httpTesterPlugin;
