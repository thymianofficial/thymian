import { describe, expect, it } from 'vitest';

import { createExecution, createToolRun, Thymian } from '../src/index.js';

describe('Thymian workflows', () => {
  it('returns clean-run with an assembled report when no findings exist', async () => {
    const thymian = new Thymian();

    thymian.emitter.onAction('core.lint', async (_event, ctx) => {
      ctx.reply([
        createToolRun({
          tool: { name: 'clean-plugin' },
          runType: 'lint',
          executions: [
            createExecution({
              location: { type: 'custom', value: 'lint' },
              findings: [],
            }),
          ],
        }),
      ]);
    });

    const report = await thymian.lint({ specification: [], rules: [] });

    expect(report.runs[0]?.tool.name).toBe('clean-plugin');

    await thymian.close();
  });

  it('returns findings when report contains warn or error findings', async () => {
    const thymian = new Thymian();

    thymian.emitter.onAction('core.test', async (_event, ctx) => {
      ctx.reply([
        createToolRun({
          tool: { name: 'warn-plugin' },
          runType: 'test',
          executions: [
            createExecution({
              location: { type: 'custom', value: 'test' },
              findings: [
                {
                  id: 'finding-1',
                  kind: 'rule-violation',
                  ruleId: 'example/rule',
                  title: 'Warning finding',
                  severity: 'warn',
                  message: { text: 'Warning finding' },
                },
              ],
            }),
          ],
        }),
      ]);
    });

    const report = await thymian.test({ specification: [], rules: [] });

    expect(report.runs).toHaveLength(1);

    await thymian.close();
  });
});
