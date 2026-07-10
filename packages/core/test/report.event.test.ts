import { describe, expect, it } from 'vitest';

import { ajv } from '../src/ajv.js';
import { reportSchema } from '../src/events/report.event.js';
import {
  createAnalyzeExecution,
  createLintExecution,
  createReport,
  createTestCaseExecution,
  createTestStep,
  createToolRun,
} from '../src/report/index.js';

/**
 * Regression coverage for BaggersIO's PR-311 finding 8: `reportSchema` had
 * drifted to describe the pre-v4 hierarchical model (`required:
 * ['location','findings']` on every execution, `severity` required on every
 * finding, `children` present) behind an `as unknown as
 * JSONSchemaType<ReportEvent>` cast that hid the mismatch. Because
 * `TestCaseExecution` has neither `location` nor `findings`, and
 * `FindingRecord` no longer carries `severity`, a real v4 report failed this
 * schema — even though it is exactly the shape `core.report` emits.
 */
describe('reportSchema (core.report event)', () => {
  it('validates a real v4 report with lint/analyze executions', () => {
    const report = createReport([
      createToolRun({
        tool: { name: '@thymian/plugin-http-linter' },
        runType: 'lint',
        rules: [{ id: 'content-type-charset', severity: 'warn' }],
        executions: [
          createLintExecution({
            location: { type: 'custom', value: 'POST /orders' },
            ruleId: 'content-type-charset',
            status: { kind: 'failed', reason: 'missing charset' },
          }),
        ],
      }),
      createToolRun({
        tool: { name: '@thymian/plugin-http-analyzer' },
        runType: 'analyze',
        rules: [{ id: 'schema-conforms', severity: 'error' }],
        executions: [
          createAnalyzeExecution({
            location: { type: 'custom', value: 'GET /widgets' },
            ruleId: 'schema-conforms',
            status: { kind: 'failed', reason: '1 assertion(s) failed' },
            findings: [
              {
                id: 'af-1',
                kind: 'assertion-failure',
                title: 'status code',
                expected: 200,
                actual: 404,
              },
            ],
          }),
        ],
      }),
    ]);

    const valid = ajv.validate(reportSchema, report);

    expect(ajv.errors).toBeNull();
    expect(valid).toBe(true);
  });

  it('validates a real v4 report with a test-case execution (no location/findings on the execution itself)', () => {
    const report = createReport([
      createToolRun({
        tool: { name: '@thymian/plugin-http-tester' },
        runType: 'test',
        rules: [{ id: 'order-lifecycle', severity: 'error' }],
        executions: [
          createTestCaseExecution({
            name: 'Create order then fetch it',
            ruleId: 'order-lifecycle',
            status: { kind: 'failed', reason: 'Fetch failed' },
            steps: [
              createTestStep({
                name: 'Step 1',
                location: { type: 'custom', value: 'GET /orders/{id}' },
                findings: [
                  {
                    id: 'af-1',
                    kind: 'assertion-failure',
                    title: 'status mismatch',
                    expected: 200,
                    actual: 404,
                  },
                ],
              }),
            ],
          }),
        ],
      }),
    ]);

    const valid = ajv.validate(reportSchema, report);

    expect(ajv.errors).toBeNull();
    expect(valid).toBe(true);
  });
});
