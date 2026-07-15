import { ThymianFormat } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { renderReport } from '../src/render/cli-report.js';

// `renderReport` colorizes via `ux.colorize`, which emits ANSI SGR codes when
// color is enabled (e.g. Nx sets FORCE_COLOR for its tasks) and omits them for
// non-TTY output. Strip them so the content assertions are deterministic
// regardless of the ambient color environment.
const ESC = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');
const stripAnsi = (value: string): string => value.replace(ANSI_PATTERN, '');

describe('cli report renderer', () => {
  it('renders tool runs and execution status', () => {
    const output = stripAnsi(
      renderReport({
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
      }),
    );

    expect(output).toContain('@thymian/plugin-http-linter');
    expect(output).toContain('GET /pets');
    expect(output).toContain('⚠ warn: A warning');
    expect(output).toContain('› example/rule');
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

    const output = stripAnsi(
      renderReport(
        {
          reportId: 'report-1',
          createdAt: new Date().toISOString(),
          runs: [
            {
              runId: 'run-1',
              tool: { name: '@thymian/plugin-http-linter' },
              runType: 'lint',
              runAt: new Date().toISOString(),
              thymianFormatVersion: '__cli',
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
        },
        { format },
      ),
    );

    expect(output).toContain('GET /pets - application/json');
  });

  it('groups lint and analyze rows by resolved location like the markdown formatter', () => {
    const output = stripAnsi(
      renderReport({
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
      }),
    );

    // Groups are sorted by resolved location and only non-passing rows render.
    expect(output).toContain('  POST /orders');
    expect(output).toContain('    ⚠ warn: msg');
    expect(output).toContain('              › content-type-charset');
    expect(output).toContain('  GET /widgets');
    expect(output).toContain('    ✖ error: broken');
    // Fully-passing locations are omitted entirely.
    expect(output).not.toContain('GET /pets');
    // Findings attached to passing executions are not rendered.
    expect(output).not.toContain('auth-scheme deprecated');
    // The renderer no longer emits the markdown table layout.
    expect(output).not.toContain('Severity | Rule | Message');
    expect(output).not.toContain('--- | --- | ---');
  });

  it('renders failed test executions with status, duration and finding detail', () => {
    const output = stripAnsi(
      renderReport({
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
                status: { kind: 'failed', durationMilliseconds: 7 },
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
                      {
                        id: 'a-2',
                        kind: 'assertion-failure',
                        title: 'body mismatch',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );

    expect(output).toContain('happy path');
    expect(output).toContain('✖ error: Example rule (7.00ms)');
    expect(output).toContain('› example/rule');
    expect(output).toContain('✓ status ok');
    expect(output).toContain('✖ body mismatch');
  });

  it('counts failed executions once by resolved severity instead of detail findings', () => {
    const output = stripAnsi(
      renderReport({
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
      }),
    );

    // The three findings render, but the summary counts the single execution
    // once by its resolved severity.
    expect(output).toContain('✖ path parameter must be integer');
    expect(output).toContain('✖ response body must match schema');
    expect(output).toContain('ℹ schema validation context');
    expect(output).toContain('Summary: 1 error, 0 warnings, 0 hints, 0 infos.');
  });

  it('renders failed and skipped executions even when they have no findings', () => {
    const output = stripAnsi(
      renderReport({
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
      }),
    );

    expect(output).toContain('GET /missing-details');
    expect(output).toContain('✖ error');
    expect(output).toContain('› example/failure');
    expect(output).toContain('POST /skipped');
    expect(output).toContain('⏭  skipped: not applicable');
    expect(output).toContain('› example/skip');
  });

  it('uses rule metadata for display labels while preserving rule attribution', () => {
    const output = stripAnsi(
      renderReport({
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
      }),
    );

    // The rule name is used as the status label, with the rule id attributed
    // on the following line.
    expect(output).toContain('⚠ warn: Example rule');
    expect(output).toContain('› example/rule');
  });

  it('renders finding titles by kind without assertion detail payloads', () => {
    const output = stripAnsi(
      renderReport({
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
      }),
    );

    // Assertion failures render as their title only; expected/actual payloads
    // are not emitted.
    expect(output).toContain('✖ expected status');
    expect(output).toContain('✖ expected content type');
    expect(output).not.toContain('expected: 200');
    expect(output).not.toContain('text/plain');
    // Unknown finding kinds fall back to the info symbol.
    expect(output).toContain('ℹ legacy rule failure');
  });

  it('renders multi-step test executions as a step tree with resolved locations', () => {
    const output = stripAnsi(
      renderReport({
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
                status: { kind: 'failed' },
                name: 'happy path',
                steps: [
                  {
                    name: 'Step 1',
                    location: { type: 'custom', value: 'GET /pets' },
                    findings: [
                      {
                        id: 'a-1',
                        kind: 'assertion-success',
                        title: 'status ok',
                      },
                    ],
                  },
                  {
                    name: 'Step 2',
                    location: { type: 'custom', value: 'POST /pets' },
                    findings: [
                      {
                        id: 'a-2',
                        kind: 'assertion-failure',
                        title: 'created',
                      },
                    ],
                    httpTransactions: [
                      {
                        request: {
                          origin: 'https://api.example.com',
                          path: '/pets',
                          method: 'POST',
                        },
                        response: {
                          statusCode: 201,
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
      }),
    );

    expect(output).toContain('├── Step 1: GET /pets');
    expect(output).toContain('└── Step 2: POST /pets');
    expect(output).toContain('✓ status ok');
    expect(output).toContain('✖ created');
    // HTTP transaction summaries are not part of the CLI report output.
    expect(output).not.toContain('api.example.com');
  });

  it('emits only standard SGR color sequences that strip to plain text', () => {
    const rendered = renderReport({
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

    // Any ANSI the renderer emits must be standard SGR color codes: stripping
    // them leaves clean, escape-free text with the expected content intact.
    const plain = stripAnsi(rendered);
    expect(plain).not.toContain(ESC);
    expect(plain).toContain('✖ error: deterministic');
    expect(plain).toContain('› example/rule');
  });
});
