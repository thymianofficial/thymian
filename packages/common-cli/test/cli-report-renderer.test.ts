import { ThymianFormat } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { renderReport } from '../src/cli-report-renderer.js';

describe('cli report renderer', () => {
  it('renders tool runs and findings', () => {
    const output = renderReport({
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
              location: { type: 'custom', value: 'GET /pets' },
              findings: [
                {
                  id: 'finding-1',
                  kind: 'rule-violation',
                  ruleId: 'example/rule',
                  title: 'A warning',
                  severity: 'warn',
                  message: { text: 'A warning' },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(output).toContain('@thymian/plugin-http-linter');
    expect(output).toContain('GET /pets');
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
});
