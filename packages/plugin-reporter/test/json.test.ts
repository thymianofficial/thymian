import { readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import {
  createAnalyzeExecution,
  createLintExecution,
  createReport,
  createTestCaseExecution,
  createTestStep,
  createToolRun,
  NoopLogger,
  type Report,
  reportSchema,
  type RuleDescriptor,
  ThymianFormat,
} from '@thymian/core';
import { validate } from '@thymian/core/ajv';
import { describe, expect, it } from 'vitest';

import { JsonFormatter } from '../src/formatters/json.js';
import { FORMATTER_REGISTRY } from '../src/get-formatters.js';

const pluginOptions = { cwd: '/base', logger: new NoopLogger() };

const rules: RuleDescriptor[] = [
  { id: 'order-lifecycle', severity: 'error' },
  { id: 'rfc9110/request-host-header', severity: 'warn' },
];

/**
 * Report exercising every arm of the canonical model the formatter must preserve:
 * all three execution kinds, test steps, findings with `expected`/`actual`,
 * run-level artifacts/invocations, and a `thymianFormat` map for location refs.
 */
function representativeReport(): Report {
  const format = new ThymianFormat();
  const requestId = format.addRequest({
    sourceName: 'openapi.yaml',
    protocol: 'https',
    host: 'api.example.com',
    port: 443,
    method: 'post',
    path: '/orders',
    mediaType: '',
    headers: {},
    queryParameters: {},
    cookies: {},
    pathParameters: {},
  });

  return createReport(
    [
      createToolRun({
        tool: { name: '@thymian/plugin-http-linter', version: '1.2.3' },
        runType: 'lint',
        thymianFormatVersion: 'v1',
        duration: 42,
        rules,
        artifacts: [
          {
            id: 'har-1',
            description: 'captured traffic',
            path: '.thymian/traffic.har',
            mimeType: 'application/json',
          },
        ],
        invocations: [
          {
            id: 'inv-1',
            commandLine: 'thymian lint',
            arguments: ['lint'],
            duration: { start: 0, end: 42 },
            exitCode: 0,
            workingDirectory: '/repo',
          },
        ],
        executions: [
          createLintExecution({
            location: {
              type: 'thymianFormat',
              elementType: 'node',
              elementId: requestId,
              pointer: '',
            },
            ruleId: 'rfc9110/request-host-header',
            status: {
              kind: 'failed',
              reason: 'missing Host',
              severity: 'warn',
            },
            findings: [
              {
                id: 'info-1',
                kind: 'informational',
                title: 'header absent',
                message: { text: 'plain', markdown: '**md**' },
              },
            ],
          }),
          createLintExecution({
            location: { type: 'url', url: 'https://api.example.com/health' },
            ruleId: 'rfc9110/request-host-header',
            status: { kind: 'skipped', reason: 'rule opted out' },
          }),
        ],
      }),
      createToolRun({
        tool: { name: '@thymian/plugin-http-tester' },
        runType: 'test',
        rules,
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
                  {
                    id: 'as-1',
                    kind: 'assertion-success',
                    title: 'body is json',
                  },
                ],
                httpTransactions: [
                  {
                    request: {
                      protocol: 'https',
                      host: 'api.example.com',
                      port: 443,
                      method: 'get',
                      path: '/orders/1',
                      headers: { accept: 'application/json' },
                      queryParameters: {},
                      cookies: {},
                      pathParameters: {},
                      mediaType: '',
                    },
                  },
                ],
              }),
            ],
          }),
        ],
      }),
      createToolRun({
        tool: { name: '@thymian/plugin-http-analyzer' },
        runType: 'analyze',
        rules,
        executions: [
          createAnalyzeExecution({
            location: {
              type: 'file',
              path: 'openapi.yaml',
              line: 12,
              column: 3,
            },
            ruleId: 'order-lifecycle',
            status: { kind: 'passed', durationMilliseconds: 7 },
          }),
        ],
      }),
    ],
    { v1: format.export() },
  );
}

async function flushToFile(
  fileName: string,
  reports: Report[],
): Promise<{ path: string; output: string | undefined }> {
  const path = join(process.cwd(), 'tmp', fileName);
  await rm(path, { force: true });

  const formatter = new JsonFormatter(new NoopLogger());
  formatter.init({ path });
  for (const report of reports) {
    formatter.report(report);
  }

  return { path, output: await formatter.flush() };
}

describe('FORMATTER_REGISTRY.json.prepareOptions', () => {
  it('joins a configured relative path onto cwd', () => {
    const prepared = FORMATTER_REGISTRY.json.prepareOptions(
      { path: 'custom/report.json' },
      pluginOptions,
    );

    expect(prepared.path).toBe(resolve('/base', 'custom/report.json'));
  });

  it('falls back to the default path when none is configured', () => {
    const prepared = FORMATTER_REGISTRY.json.prepareOptions({}, pluginOptions);

    expect(prepared.path).toBe(
      resolve('/base', '.thymian/reports/report.json'),
    );
  });

  it('does not let an explicit undefined path wipe the default', () => {
    const prepared = FORMATTER_REGISTRY.json.prepareOptions(
      { path: undefined },
      pluginOptions,
    );

    expect(prepared.path).toBe(
      resolve('/base', '.thymian/reports/report.json'),
    );
  });

  it('keeps an absolute configured path instead of prefixing cwd', () => {
    // `resolve` with a single argument yields a platform-absolute path, so this
    // covers Windows drive-rooted paths as well as POSIX ones.
    const absolutePath = resolve('/absolute/report.json');

    const prepared = FORMATTER_REGISTRY.json.prepareOptions(
      { path: absolutePath },
      pluginOptions,
    );

    expect(prepared.path).toBe(absolutePath);
  });
});

describe('JsonFormatter output', () => {
  it('writes the canonical report verbatim, with no presentation transform', async () => {
    const report = representativeReport();
    const { path } = await flushToFile('json-roundtrip.json', [report]);

    const parsed: unknown = JSON.parse(await readFile(path, 'utf-8'));

    // Deep equality against the emitted Report proves nothing was flattened,
    // grouped, re-sorted, or location-resolved on the way out.
    expect(parsed).toEqual([report]);
  });

  it('preserves nested detail that human-readable formatters drop', async () => {
    const report = representativeReport();
    const { path } = await flushToFile('json-detail.json', [report]);

    const [parsed] = JSON.parse(await readFile(path, 'utf-8')) as Report[];

    const testRun = parsed?.runs.find((run) => run.runType === 'test');
    const testExecution = testRun?.executions?.[0];
    expect(testExecution?.kind).toBe('test');
    if (testExecution?.kind !== 'test') {
      throw new Error('expected a test execution');
    }

    const step = testExecution.steps[0];
    expect(step?.httpTransactions?.[0]?.request.path).toBe('/orders/1');
    expect(step?.findings).toEqual([
      {
        id: 'af-1',
        kind: 'assertion-failure',
        title: 'status mismatch',
        expected: 200,
        actual: 404,
      },
      { id: 'as-1', kind: 'assertion-success', title: 'body is json' },
    ]);

    const lintRun = parsed?.runs.find((run) => run.runType === 'lint');
    expect(lintRun?.artifacts?.[0]?.id).toBe('har-1');
    expect(lintRun?.invocations?.[0]?.commandLine).toBe('thymian lint');
    expect(lintRun?.executions?.[0]?.location).toEqual({
      type: 'thymianFormat',
      elementType: 'node',
      elementId: expect.any(String),
      pointer: '',
    });
    expect(parsed?.thymianFormat?.['v1']).toBeDefined();
  });

  it('collects every report of the session into one top-level array, in order', async () => {
    const first = createReport([
      createToolRun({ tool: { name: 'first' }, runType: 'lint' }),
    ]);
    const second = createReport([
      createToolRun({ tool: { name: 'second' }, runType: 'test' }),
    ]);

    const { path } = await flushToFile('json-multi.json', [first, second]);
    const parsed = JSON.parse(await readFile(path, 'utf-8')) as Report[];

    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.reportId).toBe(first.reportId);
    expect(parsed[1]?.reportId).toBe(second.reportId);
  });

  it('writes compact JSON', async () => {
    const { output } = await flushToFile('json-compact.json', [
      representativeReport(),
    ]);

    expect(output).toBeDefined();
    expect(output).not.toContain('\n');
  });

  it('writes no file and returns undefined when the session produced no report', async () => {
    const path = join(process.cwd(), 'tmp', 'json-empty.json');
    await rm(path, { force: true });

    const formatter = new JsonFormatter(new NoopLogger());
    formatter.init({ path });

    await expect(formatter.flush()).resolves.toBeUndefined();
    await expect(readFile(path, 'utf-8')).rejects.toThrow();
  });
});

describe('JsonFormatter schema validity', () => {
  it('emits reports that still validate against the core.report schema', async () => {
    const { path } = await flushToFile('json-schema.json', [
      representativeReport(),
    ]);

    const parsed = JSON.parse(await readFile(path, 'utf-8')) as unknown[];

    for (const report of parsed) {
      expect(validate(reportSchema, report)).toBe(true);
    }
  });
});
