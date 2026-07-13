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
    expect(output).toContain('⚠ warning example/rule');
    expect(output).toContain('A warning');
    expect(output).toContain('Summary:');
  });

  it('renders thymian format locations through the core location resolver', () => {
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

    const output = renderReport({
      reportId: 'report-1',
      createdAt: new Date().toISOString(),
      thymianFormat: { v1: format.export() },
      runs: [
        {
          runId: 'run-1',
          tool: { name: '@thymian/plugin-http-linter' },
          runType: 'lint',
          runAt: new Date().toISOString(),
          thymianFormatVersion: 'v1',
          executions: [
            {
              kind: 'lint',
              ruleId: 'example/rule',
              status: { kind: 'failed', reason: 'bad endpoint' },
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
    });

    expect(output).toContain('GET /pets - application/json');
  });

  it('groups lint and analyze rows by resolved location like the markdown formatter', () => {
    const output = renderReport({
      reportId: 'report-1',
      createdAt: new Date().toISOString(),
      runs: [
        {
          runId: 'run-1',
          tool: { name: '@thymian/plugin-http-linter' },
          runType: 'lint',
          runAt: new Date().toISOString(),
          rules: [{ id: 'content-type-charset', severity: 'warn' }],
          executions: [
            {
              kind: 'lint',
              ruleId: 'content-type-charset',
              status: { kind: 'failed', reason: 'msg' },
              location: { type: 'custom', value: 'POST /orders' },
              findings: [],
            },
            {
              kind: 'lint',
              ruleId: 'content-type-charset',
              status: { kind: 'passed' },
              location: { type: 'custom', value: 'POST /orders' },
              findings: [
                {
                  id: 'info-1',
                  kind: 'informational',
                  title: 'noted',
                  message: { text: 'auth-scheme deprecated' },
                },
              ],
            },
            {
              kind: 'lint',
              status: { kind: 'failed', reason: 'broken' },
              location: { type: 'custom', value: 'GET /widgets' },
              findings: [],
            },
            {
              kind: 'lint',
              status: { kind: 'passed' },
              location: { type: 'custom', value: 'GET /pets' },
              findings: [],
            },
          ],
        },
      ],
    });

    expect(output).toContain('  POST /orders');
    expect(output).toContain('    ⚠ warning content-type-charset');
    expect(output).toContain('      msg');
    expect(output).toContain('    ℹ info content-type-charset');
    expect(output).toContain('      auth-scheme deprecated');
    expect(output).toContain('  GET /widgets');
    expect(output).toContain('    ✖ error unnamed check');
    expect(output).toContain('      broken');
    expect(output).not.toContain('  GET /pets');
    expect(output).not.toContain('Severity | Rule | Message');
    expect(output).not.toContain('--- | --- | ---');
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
    expect(output).toContain('passed (7.00ms)');
    expect(output).toContain('case: happy');
    expect(output).toContain('status ok');
  });

  it('counts failed executions once by resolved severity instead of detail findings', () => {
    const output = renderReport({
      reportId: 'report-1',
      createdAt: new Date().toISOString(),
      runs: [
        {
          runId: 'run-1',
          tool: { name: '@thymian/plugin-http-analyzer' },
          runType: 'analyze',
          runAt: new Date().toISOString(),
          rules: [{ id: 'example/schema', severity: 'error' }],
          executions: [
            {
              kind: 'analyze',
              ruleId: 'example/schema',
              status: { kind: 'failed', reason: '2 assertion(s) failed' },
              location: { type: 'custom', value: 'GET /pets/abc' },
              findings: [
                {
                  id: 'a-1',
                  kind: 'assertion-failure',
                  title: 'path parameter must be integer',
                  expected: { type: 'integer' },
                  actual: 'abc',
                },
                {
                  id: 'a-2',
                  kind: 'assertion-failure',
                  title: 'response body must match schema',
                  expected: { type: 'number' },
                  actual: 'abc',
                },
                {
                  id: 'info-1',
                  kind: 'informational',
                  title: 'schema validation context',
                },
              ],
            },
          ],
        },
      ],
    });

    expect(output).toContain(
      'Summary: 1 error(s), 0 warning(s), 0 hint(s), 0 info(s).',
    );
  });

  it('renders failed and skipped executions even when they have no findings', () => {
    const output = renderReport({
      reportId: 'report-1',
      createdAt: new Date().toISOString(),
      runs: [
        {
          runId: 'run-1',
          tool: { name: '@thymian/plugin-http-linter' },
          runType: 'lint',
          runAt: new Date().toISOString(),
          rules: [
            { id: 'example/failure', severity: 'error' },
            { id: 'example/skip', severity: 'hint' },
          ],
          executions: [
            {
              kind: 'lint',
              ruleId: 'example/failure',
              status: { kind: 'failed' },
              location: { type: 'custom', value: 'GET /missing-details' },
              findings: [],
            },
            {
              kind: 'lint',
              ruleId: 'example/skip',
              status: { kind: 'skipped', reason: 'not applicable' },
              location: { type: 'custom', value: 'POST /skipped' },
              findings: [],
            },
          ],
        },
      ],
    });

    expect(output).toContain('GET /missing-details');
    expect(output).toContain('✖ error example/failure');
    expect(output).toContain('POST /skipped');
    expect(output).toContain('⏭ skipped example/skip');
    expect(output).toContain('not applicable');
  });

  it('uses rule metadata for display labels while preserving rule attribution', () => {
    const output = renderReport({
      reportId: 'report-1',
      createdAt: new Date().toISOString(),
      runs: [
        {
          runId: 'run-1',
          tool: { name: '@thymian/plugin-http-linter' },
          runType: 'lint',
          runAt: new Date().toISOString(),
          rules: [
            {
              id: 'example/rule',
              name: 'Example rule',
              severity: 'warn',
            },
          ],
          executions: [
            {
              kind: 'lint',
              ruleId: 'example/rule',
              status: { kind: 'failed' },
              location: { type: 'custom', value: 'GET /pets' },
              findings: [],
            },
          ],
        },
      ],
    });

    expect(output).toContain('⚠ warning Example rule (example/rule)');
  });

  it('renders only supported finding kinds and assertion details when present', () => {
    const output = renderReport({
      reportId: 'report-1',
      createdAt: new Date().toISOString(),
      runs: [
        {
          runId: 'run-1',
          tool: { name: '@thymian/plugin-http-analyzer' },
          runType: 'analyze',
          runAt: new Date().toISOString(),
          executions: [
            {
              kind: 'analyze',
              status: { kind: 'failed' },
              location: { type: 'custom', value: 'GET /pets' },
              findings: [
                {
                  id: 'supported-1',
                  kind: 'assertion-failure',
                  title: 'expected status',
                  expected: 200,
                },
                {
                  id: 'supported-2',
                  kind: 'assertion-failure',
                  title: 'expected content type',
                  actual: 'text/plain',
                },
                {
                  id: 'legacy-1',
                  kind: 'rule-failure',
                  title: 'legacy rule failure',
                },
              ],
            },
          ],
        },
      ],
    });

    expect(output).toContain('✖ failed unnamed check');
    expect(output).toContain('expected status — expected: 200');
    expect(output).not.toContain('actual: undefined');
    expect(output).toContain('expected content type — actual: "text/plain"');
    expect(output).not.toContain('expected: undefined');
    expect(output).not.toContain('legacy rule failure');
  });

  it('renders test step HTTP transaction summaries', () => {
    const output = renderReport({
      reportId: 'report-1',
      createdAt: new Date().toISOString(),
      runs: [
        {
          runId: 'run-1',
          tool: { name: '@thymian/plugin-http-tester' },
          runType: 'test',
          runAt: new Date().toISOString(),
          executions: [
            {
              kind: 'test',
              status: { kind: 'passed' },
              name: 'happy path',
              steps: [
                {
                  name: 'Step 1',
                  location: { type: 'custom', value: 'GET /pets' },
                  findings: [],
                  httpTransactions: [
                    {
                      request: {
                        origin: 'https://api.example.com',
                        path: '/pets',
                        method: 'GET',
                      },
                      response: {
                        statusCode: 200,
                        headers: {},
                        trailers: {},
                        duration: 12,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(output).toContain('Step 1 GET /pets');
    expect(output).toContain('HTTP: GET https://api.example.com/pets -> 200');
  });

  it('does not emit ANSI color codes for non-TTY output', () => {
    const output = renderReport({
      reportId: 'report-1',
      createdAt: new Date().toISOString(),
      runs: [
        {
          runId: 'run-1',
          tool: { name: '@thymian/plugin-http-linter' },
          runType: 'lint',
          runAt: new Date().toISOString(),
          rules: [{ id: 'example/rule', severity: 'error' }],
          executions: [
            {
              kind: 'lint',
              ruleId: 'example/rule',
              status: { kind: 'failed', reason: 'deterministic' },
              location: { type: 'custom', value: 'GET /pets' },
              findings: [],
            },
          ],
        },
      ],
    });

    expect(output).not.toContain(`${String.fromCharCode(27)}[`);
  });
});
