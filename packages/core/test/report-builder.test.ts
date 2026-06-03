import { createReport, createToolRun, httpTestResultToRuleFindings } from '../src/report/index.js';
import { describe, expect, it } from 'vitest';

describe('report builders', () => {
  it('creates reports and tool runs with generated identifiers', () => {
    const run = createToolRun({
      tool: { name: 'tool' },
      runType: 'lint',
      executions: [],
    });

    const report = createReport([run]);

    expect(run.runId).toBeTruthy();
    expect(run.runAt).toContain('T');
    expect(report.reportId).toBeTruthy();
  });

  it('maps http test results to v4 findings', () => {
    const findings = httpTestResultToRuleFindings([
      {
        type: 'assertion-failure',
        message: 'status should match',
        expected: 200,
        actual: 500,
      },
      {
        type: 'skip',
        message: 'skipped case',
        reason: 'missing dependency',
      },
    ]);

    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({ kind: 'assertion-failure', severity: 'error' });
    expect(findings[1]).toMatchObject({ kind: 'test-case-skip', severity: 'info' });
  });
});
