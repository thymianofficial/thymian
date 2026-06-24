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

  it('recursively renders nested executions and per-kind details', () => {
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
              location: { type: 'custom', value: 'GET /pets' },
              findings: [
                {
                  id: 'rv-1',
                  kind: 'rule-violation',
                  ruleId: 'example/rule',
                  title: 'A violation',
                  severity: 'error',
                  message: { text: 'A violation' },
                },
              ],
              children: [
                {
                  location: { type: 'custom', value: 'case: happy' },
                  findings: [
                    {
                      id: 'tc-pass',
                      kind: 'test-case-pass',
                      title: 'passes',
                      severity: 'info',
                      durationMilliseconds: 7,
                      nestedFindings: [
                        {
                          type: 'composed-of',
                          finding: {
                            id: 'a-1',
                            kind: 'assertion-success',
                            title: 'status ok',
                            severity: 'info',
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    // inline ruleId on headline + descriptor help line
    expect(output).toContain('example/rule');
    expect(output).toContain('help: https://example.com/rule');
    // nested execution and nested assertion are both rendered
    expect(output).toContain('case: happy');
    expect(output).toContain('duration: 7ms');
    expect(output).toContain('status ok');
  });
});
