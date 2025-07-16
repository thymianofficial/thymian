import {
  type Logger,
  ThymianEmitter,
  type ThymianPlugin,
  type ThymianReport,
} from '@thymian/core';

import { report } from './report.js';

export const cliReporterPlugin: ThymianPlugin = {
  name: '@thymian/cli-reporter',
  version: '0.x',
  events: {
    listensOn: ['core.report'],
  },
  async plugin(emitter: ThymianEmitter, logger: Logger): Promise<void> {
    const reports: ThymianReport[] = [];

    emitter.on('core.report', (report) => {
      reports.push(report);
    });

    emitter.onAction('core.close', (_, ctx) => {
      report(reports);
      ctx.reply();
    });
  },
};

export default cliReporterPlugin;
