import { ThymianFormat } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { renderReport } from '../src/cli-report-renderer.js';

describe('cli report renderer', () => {
  it('renders tool runs and execution status', () => {
    const output = renderReport({
      reportId: 'report-1',
      createdAt: new Date().toISOString(),
      runs: [
        {
          runId: 'run-1',
          tool: { name: '@thymian/plugin-http-linter' },
          runType: 'lint',
          runAt: new Date().toISOString(),
          rules: [{ id: 'example/rule', severity: 'warn' }],
          executions: [
            {
              kind: 'lint',
              ruleId: 'example/rule',
              status: { kind: 'failed', reason: 'A warning' },
              location: { type: 'custom', value: 'GET /pets' },
              findings: [],
            },
          ],
        },
      ],
    });

    expect(output).toContain('@thymian/plugin-http-linter');
    expect(output).toContain('GET /pets');
    expect(output).toContain('failed: A warning');
    expect(output).toContain('Summary:');
  });

  it('renders thymian format locations as endpoint strings', () => {
    const format = new ThymianFormat();
    const requestId = format.addRequest({
      sourceName: 'openapi.yaml',
      protocol: 'https',
      host: 'api.example.com',
      port: 443,
      method: 'get',
      path: '/pets',
      mediaType: 'application/json',
      headers: {},
      queryParameters: {},
      cookies: {},
      pathParameters: {},
    });

    const output = renderReport(
      {
        reportId: 'report-1',
        createdAt: new Date().toISOString(),
        runs: [
          {
            runId: 'run-1',
            tool: { name: '@thymian/plugin-http-linter' },
            runType: 'lint',
            runAt: new Date().toISOString(),
            executions: [
              {
                kind: 'lint',
                ruleId: 'example/rule',
                status: { kind: 'passed' },
                location: {
                  type: 'thymianFormat',
                  elementType: 'node',
                  elementId: requestId,
                  pointer: '',
                },
                findings: [],
              },
            ],
          },
        ],
      },
      { format },
    );

    expect(output).toContain('GET /pets - application/json');
  });

  it('renders test executions with status, steps and finding detail', () => {
    const output = renderReport({
      reportId: 'report-1',
      createdAt: new Date().toISOString(),
      runs: [
        {
          runId: 'run-1',
          tool: { name: '@thymian/plugin-http-tester' },
          runType: 'test',
          runAt: new Date().toISOString(),
          rules: [
            {
              id: 'example/rule',
              severity: 'error',
              name: 'Example rule',
              helpUri: 'https://example.com/rule',
            },
          ],
          executions: [
            {
              kind: 'test',
              ruleId: 'example/rule',
              status: { kind: 'passed', durationMilliseconds: 7 },
              name: 'happy path',
              steps: [
                {
                  name: 'Step 1',
                  location: { type: 'custom', value: 'case: happy' },
                  findings: [
                    {
                      id: 'a-1',
                      kind: 'assertion-success',
                      title: 'status ok',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(output).toContain('example/rule');
    expect(output).toContain('passed (7ms)');
    expect(output).toContain('case: happy');
    expect(output).toContain('status ok');
  });
});
