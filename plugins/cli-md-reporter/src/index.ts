import {
  ThymianEmitter,
  type ThymianPlugin,
  type ThymianReport,
} from '@thymian/core';

import { mdReport } from './md-report.js';

export const cliMdReporterPlugin: ThymianPlugin = {
  name: '@thymian/cli-md-reporter',
  version: '0.x',
  events: {
    listensOn: ['core.report'],
  },
  async plugin(emitter: ThymianEmitter): Promise<void> {
    const reports: ThymianReport[] = [];

    emitter.on('core.report', (report) => {
      reports.push(report);
    });

    emitter.onAction('core.close', async (_, ctx) => {
      await mdReport(reports);
      ctx.reply();
    });
  },
};

export default cliMdReporterPlugin;
