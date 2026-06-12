import { describe, expect, it } from 'vitest';

import {
  createExecution,
  createReport,
  createToolRun,
} from '../src/report/index.js';

describe('report v4 model', () => {
  it('creates nested report structures', () => {
    const execution = createExecution({
      location: { type: 'custom', value: 'GET /pets' },
      findings: [
        {
          id: 'finding-1',
          kind: 'rule-violation',
          ruleId: 'example/rule',
          title: 'Example finding',
          severity: 'error',
          message: { text: 'Example finding' },
        },
      ],
      children: [
        createExecution({
          location: { type: 'file', path: 'openapi.yaml', line: 12, column: 5 },
          findings: [],
        }),
      ],
    });

    const run = createToolRun({
      tool: { name: '@thymian/plugin-http-linter' },
      runType: 'lint',
      executions: [execution],
    });

    const report = createReport([run]);

    expect(report.runs).toHaveLength(1);
    expect(report.runs[0]?.executions?.[0]?.children).toHaveLength(1);
    expect(report.reportId).toBeTruthy();
    expect(report.createdAt).toContain('T');
  });
});
