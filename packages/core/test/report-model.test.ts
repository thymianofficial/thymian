import { describe, expect, it } from 'vitest';

import {
  createLintExecution,
  createReport,
  createTestCaseExecution,
  createTestStep,
  createToolRun,
} from '../src/report/index.js';

describe('flat per-runType report model', () => {
  it('creates flat, per-runType executions with status', () => {
    const execution = createLintExecution({
      location: { type: 'custom', value: 'GET /pets' },
      ruleId: 'example/rule',
      status: { kind: 'failed', reason: 'Example finding' },
      findings: [],
    });

    const run = createToolRun({
      tool: { name: '@thymian/plugin-http-linter' },
      runType: 'lint',
      executions: [execution],
    });

    const report = createReport([run]);

    expect(report.runs).toHaveLength(1);
    const first = report.runs[0]?.executions?.[0];
    expect(first?.kind).toBe('lint');
    expect(first?.status.kind).toBe('failed');
    expect(first && 'children' in first).toBe(false);
    expect(report.reportId).toBeTruthy();
    expect(report.createdAt).toContain('T');
  });

  it('models test cases as executions carrying steps (no findings on the case)', () => {
    const execution = createTestCaseExecution({
      name: 'creates a pet',
      ruleId: 'example/test',
      status: { kind: 'passed', durationMilliseconds: 12 },
      steps: [
        createTestStep({
          name: 'Step 1',
          location: { type: 'custom', value: 'POST /pets' },
          findings: [
            { id: 'a1', kind: 'assertion-success', title: 'status is 201' },
          ],
        }),
      ],
    });

    expect(execution.kind).toBe('test');
    expect('findings' in execution).toBe(false);
    expect(execution.steps).toHaveLength(1);
    expect(execution.steps[0]?.findings[0]?.kind).toBe('assertion-success');
  });
});
