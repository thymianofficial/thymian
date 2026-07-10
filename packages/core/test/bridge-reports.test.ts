import { describe, expect, it } from 'vitest';

import {
  createLintExecution,
  createToolRun,
  type Report,
  Thymian,
} from '../src/index.js';

describe('report assembly', () => {
  it('collects tool runs into a single report and emits core.report once', async () => {
    const thymian = new Thymian();

    thymian.emitter.onAction('core.lint', async (_event, ctx) => {
      ctx.reply([
        createToolRun({
          tool: { name: 'test-plugin' },
          runType: 'lint',
          executions: [
            createLintExecution({
              location: { type: 'custom', value: 'lint' },
              ruleId: 'example/rule',
              status: { kind: 'failed', reason: 'Example warning' },
            }),
          ],
        }),
      ]);
    });

    const emitted: Report[] = [];
    thymian.emitter.on('core.report', (report) => emitted.push(report));

    const report = await thymian.lint({ specification: [], rules: [] });

    expect(report.runs).toHaveLength(1);
    expect(emitted).toHaveLength(1);

    await thymian.close();
  });
});
