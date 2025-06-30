import { ThymianEmitter, type ThymianPlugin } from '@thymian/core';
import type { HttpLintResult } from '@thymian/http-linter';

export const httpLinterCliReporterPlugin: ThymianPlugin = {
  name: '@thymian/http-linter-cli-reporter',
  version: '0.x',
  async plugin(emitter: ThymianEmitter): Promise<void> {
    const results: Record<string, HttpLintResult[]> = {};

    emitter.onEvent('http-linter.report', (report) => {
      results[report.rule] ??= [];

      results[report.rule]?.push(report);
    });

    emitter.onHook('core.close', () => {
      console.log(results);

      return {
        pluginName: '@thymian/http-linter-cli-reporter',
        status: 'success',
      };
    });
  },
};

export default httpLinterCliReporterPlugin;
