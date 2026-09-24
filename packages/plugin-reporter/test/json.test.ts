import { readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

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
import { defaultRunDirectoryName } from '../src/report-file-name.js';

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

/**
 * Drive reports through a formatter rooted in its own scratch `cwd`, and hand
 * back where each one landed: there is no configurable path any more, so a
 * report's destination is derived from the report itself.
 */
async function writeReports(
  name: string,
  reports: Report[],
): Promise<{ paths: string[]; output: string | undefined }> {
  const cwd = join(process.cwd(), 'tmp', name);
  await rm(cwd, { recursive: true, force: true });

  const formatter = new JsonFormatter(new NoopLogger());
  formatter.init({ cwd });
  for (const report of reports) {
    await formatter.report(report);
  }

  return {
    paths: reports.map((report) =>
      join(
        cwd,
        '.thymian',
        'reports',
        defaultRunDirectoryName(report),
        'report.json',
      ),
    ),
    output: await formatter.flush(),
  };
}

describe('JsonFormatter output', () => {
  it('writes the canonical report verbatim, with no presentation transform', async () => {
    const report = representativeReport();
    const {
      paths: [path = ''],
    } = await writeReports('json-roundtrip', [report]);

    const parsed: unknown = JSON.parse(await readFile(path, 'utf-8'));

    // Deep equality against the emitted Report proves nothing was flattened,
    // grouped, re-sorted, or location-resolved on the way out.
    expect(parsed).toEqual([report]);
  });

  it('preserves nested detail that human-readable formatters drop', async () => {
    const report = representativeReport();
    const {
      paths: [path = ''],
    } = await writeReports('json-detail', [report]);

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

  it('wraps every report in a top-level array, so the payload shape never changes', async () => {
    const report = createReport([
      createToolRun({ tool: { name: 'first' }, runType: 'lint' }),
    ]);

    const {
      paths: [path = ''],
    } = await writeReports('json-array-shape', [report]);
    const parsed = JSON.parse(await readFile(path, 'utf-8')) as Report[];

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.reportId).toBe(report.reportId);
  });

  it('writes compact JSON', async () => {
    const { output } = await writeReports('json-compact', [
      representativeReport(),
    ]);

    expect(output).toBeDefined();
    expect(output).not.toContain('\n');
  });

  it('writes no file and returns undefined when the session produced no report', async () => {
    const cwd = join(process.cwd(), 'tmp', 'json-empty');
    await rm(cwd, { recursive: true, force: true });

    const formatter = new JsonFormatter(new NoopLogger());
    formatter.init({ cwd });

    await expect(formatter.flush()).resolves.toBeUndefined();
    await expect(readdir(join(cwd, '.thymian', 'reports'))).rejects.toThrow();
  });
});

describe('JsonFormatter schema validity', () => {
  it('emits reports that still validate against the core.report schema', async () => {
    const {
      paths: [path = ''],
    } = await writeReports('json-schema', [representativeReport()]);

    const parsed = JSON.parse(await readFile(path, 'utf-8')) as unknown[];

    for (const report of parsed) {
      expect(validate(reportSchema, report)).toBe(true);
    }
  });
});

describe('JsonFormatter derived run directory', () => {
  it('writes report.json in a per-run directory under .thymian/reports', async () => {
    const cwd = join(process.cwd(), 'tmp', 'json-derived');
    await rm(cwd, { recursive: true, force: true });

    const formatter = new JsonFormatter(new NoopLogger());
    formatter.init({ cwd });
    await formatter.report(representativeReport());
    await formatter.flush();

    const reportsDir = join(cwd, '.thymian', 'reports');
    const runDirectories = await readdir(reportsDir);
    const [runDirectory = ''] = runDirectories;

    expect(runDirectories).toHaveLength(1);
    // `<stamp>-<shortId>`: both parts non-empty, so a degenerate `-` fails.
    expect(runDirectory).toMatch(/^.+-[A-Za-z0-9]+$/);
    expect(await readdir(join(reportsDir, runDirectory))).toEqual([
      'report.json',
    ]);
  });

  it('gives two reports of one session two run directories, each holding its own report', async () => {
    // The `serve` defect: one plugin instance serves every workflow, so a
    // destination pinned on the first report aggregated workflow 2 into
    // workflow 1's file.
    const first = createReport([
      createToolRun({ tool: { name: 'first' }, runType: 'lint' }),
    ]);
    const second = createReport([
      createToolRun({ tool: { name: 'second' }, runType: 'test' }),
    ]);

    const { paths } = await writeReports('json-two-reports', [first, second]);
    const cwd = join(process.cwd(), 'tmp', 'json-two-reports');

    expect(await readdir(join(cwd, '.thymian', 'reports'))).toHaveLength(2);
    expect(paths[0]).not.toBe(paths[1]);

    for (const [index, report] of [first, second].entries()) {
      const parsed = JSON.parse(
        await readFile(paths[index] ?? '', 'utf-8'),
      ) as Report[];

      // Each file holds exactly its own report — nothing pooled, nothing lost.
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.reportId).toBe(report.reportId);
    }
  });

  it('honours a custom reportsDir, relative to cwd and absolute as-is', async () => {
    const cwd = join(process.cwd(), 'tmp', 'json-custom-base');
    await rm(cwd, { recursive: true, force: true });

    const relative = new JsonFormatter(new NoopLogger());
    relative.init({ cwd, reportsDir: 'build/rep' });
    await relative.report(representativeReport());
    await relative.flush();

    const absoluteBase = join(cwd, 'absolute-base');
    const absolute = new JsonFormatter(new NoopLogger());
    absolute.init({ cwd: join(cwd, 'elsewhere'), reportsDir: absoluteBase });
    await absolute.report(representativeReport());
    await absolute.flush();

    expect(await readdir(join(cwd, 'build', 'rep'))).toHaveLength(1);
    expect(await readdir(absoluteBase)).toHaveLength(1);
    // A custom base takes over completely — the default one is never touched.
    await expect(readdir(join(cwd, '.thymian'))).rejects.toThrow();
    await expect(readdir(join(cwd, 'elsewhere'))).rejects.toThrow();
  });

  it('writes nothing when no report arrived', async () => {
    const cwd = join(process.cwd(), 'tmp', 'json-derived-empty');
    await rm(cwd, { recursive: true, force: true });

    const formatter = new JsonFormatter(new NoopLogger());
    formatter.init({ cwd });

    await expect(formatter.flush()).resolves.toBeUndefined();
    await expect(readdir(join(cwd, '.thymian', 'reports'))).rejects.toThrow();
  });
});
