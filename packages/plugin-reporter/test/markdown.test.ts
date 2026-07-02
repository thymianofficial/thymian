import { join } from 'node:path';

import {
  createLintExecution,
  createReport,
  createTestCaseExecution,
  createTestStep,
  createToolRun,
  NoopLogger,
  type RuleDescriptor,
} from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { MarkdownFormatter } from '../src/formatters/markdown.js';
import {
  errorSymbol,
  hintSymbol,
  infoSymbol,
  skippedSymbol,
  successSymbol,
  warnSymbol,
} from '../src/style.js';

function render(report: ReturnType<typeof createReport>): Promise<string> {
  const formatter = new MarkdownFormatter(new NoopLogger());
  formatter.init({ path: join(process.cwd(), 'tmp', 'markdown.test.md') });
  formatter.report(report);
  return formatter.flush().then((output) => output ?? '');
}

function failedLint(
  location: string,
  opts: { ruleId?: string; reason?: string } = {},
) {
  return createLintExecution({
    location: { type: 'custom', value: location },
    ruleId: opts.ruleId,
    status: { kind: 'failed', reason: opts.reason ?? 'failure' },
  });
}

describe('style symbols (AC14)', () => {
  it('keeps error/warn/success glyphs and updates hint/info/skipped', () => {
    expect(errorSymbol).toBe('✖');
    expect(warnSymbol).toBe('⚠');
    expect(successSymbol).toBe('✓');
    expect(hintSymbol).toBe('✎');
    expect(infoSymbol).toBe('ℹ');
    expect(skippedSymbol).toBe('⏭');
  });
});

describe('MarkdownFormatter roll-up header (AC1)', () => {
  it('rolls up severity counts across all runs', async () => {
    const rules: RuleDescriptor[] = [
      { id: 'rule-error', severity: 'error' },
      { id: 'rule-warn', severity: 'warn' },
      { id: 'rule-hint', severity: 'hint' },
      { id: 'rule-info', severity: 'info' },
    ];
    const report = createReport([
      createToolRun({
        tool: { name: 'run-a' },
        runType: 'lint',
        rules,
        executions: [
          failedLint('L1', { ruleId: 'rule-error' }),
          failedLint('L2', { ruleId: 'rule-error' }),
        ],
      }),
      createToolRun({
        tool: { name: 'run-b' },
        runType: 'lint',
        rules,
        executions: [
          failedLint('L3', { ruleId: 'rule-error' }),
          failedLint('L4', { ruleId: 'rule-error' }),
          failedLint('L5', { ruleId: 'rule-warn' }),
        ],
      }),
      createToolRun({
        tool: { name: 'run-c' },
        runType: 'lint',
        rules,
        executions: [
          failedLint('L6', { ruleId: 'rule-hint' }),
          failedLint('L7', { ruleId: 'rule-info' }),
          failedLint('L8', { ruleId: 'rule-info' }),
          failedLint('L9', { ruleId: 'rule-info' }),
        ],
      }),
    ]);

    const output = await render(report);

    expect(output).toContain('<span style="color:#d1242f">✖ 4 errors</span>');
    expect(output).toContain('<span style="color:#9a6700">⚠ 1 warning</span>');
    expect(output).toContain('<span style="color:#0969da">✎ 1 hint</span>');
    expect(output).toContain('<span style="color:#57606a">ℹ 3 info</span>');
    expect(output).toMatch(
      /— across 3 runs · generated \d{4}-\d{2}-\d{2} \d{2}:\d{2}/,
    );
  });
});

describe('MarkdownFormatter legend (AC2)', () => {
  it('renders the legend exactly once', async () => {
    const report = createReport([
      createToolRun({
        tool: { name: 'tool' },
        runType: 'lint',
        executions: [failedLint('L1')],
      }),
    ]);

    const output = await render(report);

    expect(output).toContain(
      '<sub>✖ error · ⚠ warning · ✎ hint · ℹ info · ✓ passed · ⏭ skipped</sub>',
    );
    expect(output.split('<sub>').length - 1).toBe(1);
  });
});

describe('MarkdownFormatter run overview (AC3, AC4)', () => {
  it('renders an outcome row and a plain, meta-free run heading', async () => {
    const run = createToolRun({
      tool: { name: '@thymian/plugin-http-linter' },
      runType: 'lint',
      duration: 1230,
      executions: [
        failedLint('L1'),
        failedLint('L2'),
        failedLint('L3'),
        failedLint('L4'),
        createLintExecution({
          location: { type: 'custom', value: 'L5' },
          status: { kind: 'skipped' },
        }),
        ...Array.from({ length: 5 }, (_, i) =>
          createLintExecution({
            location: { type: 'custom', value: `P${i}` },
            status: { kind: 'passed' },
          }),
        ),
      ],
    });
    const report = createReport([run]);

    const output = await render(report);

    expect(output).toContain(
      '| @thymian/plugin-http-linter | lint | ✖ 4 failed · ⏭ 1 skipped · ✓ 5 passed | 1.23s |',
    );
    expect(output).toContain('## @thymian/plugin-http-linter · lint');
    expect(output).not.toContain('Ran ');
  });
});

describe('MarkdownFormatter lint/analyze bodies (AC5-AC8)', () => {
  const rules: RuleDescriptor[] = [
    { id: 'content-type-charset', severity: 'warn' },
  ];

  const report = createReport([
    createToolRun({
      tool: { name: '@thymian/plugin-http-linter' },
      runType: 'lint',
      rules,
      executions: [
        createLintExecution({
          location: { type: 'custom', value: 'POST /orders' },
          ruleId: 'content-type-charset',
          status: { kind: 'failed', reason: 'msg' },
        }),
        createLintExecution({
          location: { type: 'custom', value: 'POST /orders' },
          ruleId: 'content-type-charset',
          status: { kind: 'passed' },
          findings: [
            {
              id: 'info-1',
              kind: 'informational',
              title: 'noted',
              message: { text: 'auth-scheme deprecated' },
            },
          ],
        }),
        createLintExecution({
          location: { type: 'custom', value: 'GET /widgets' },
          status: { kind: 'failed', reason: 'broken' },
        }),
        createLintExecution({
          location: { type: 'custom', value: 'GET /pets' },
          status: { kind: 'passed' },
        }),
      ],
    }),
  ]);

  it('groups failed/informational rows by resolved location (AC5, AC6, AC8)', async () => {
    const output = await render(report);

    expect(output).toContain('### POST /orders');
    expect(output).toContain('| warning | `content-type-charset` | msg |');
    expect(output).toContain(
      '| info | `content-type-charset` | auth-scheme deprecated |',
    );
    expect(output).toContain('### GET /widgets');
    expect(output).toContain('| error | unnamed check | broken |');
  });

  it('omits passed executions with no findings and their location (AC7)', async () => {
    const output = await render(report);

    expect(output).not.toContain('### GET /pets');
  });
});

describe('MarkdownFormatter test bodies (AC9-AC12)', () => {
  const rules: RuleDescriptor[] = [
    { id: 'order-lifecycle', severity: 'error' },
  ];

  const report = createReport([
    createToolRun({
      tool: { name: '@thymian/plugin-http-tester' },
      runType: 'test',
      rules,
      executions: [
        createTestCaseExecution({
          name: 'GET /pets returns 200',
          status: { kind: 'passed' },
          steps: [],
        }),
        createTestCaseExecution({
          name: 'Create order then fetch it',
          ruleId: 'order-lifecycle',
          status: {
            kind: 'failed',
            reason: 'The created order could not be retrieved.',
          },
          steps: [
            createTestStep({
              name: 'Step 1',
              location: { type: 'custom', value: 'POST /orders' },
              findings: [
                {
                  id: 'as-1',
                  kind: 'assertion-success',
                  title: 'Create returns 201',
                  message: { text: 'Response status is 201.' },
                },
              ],
            }),
            createTestStep({
              name: 'Step 2',
              location: { type: 'custom', value: 'GET /orders/{id}' },
              findings: [
                {
                  id: 'af-1',
                  kind: 'assertion-failure',
                  title: 'Fetch returns 200',
                  message: { text: 'Response status did not match.' },
                  expected: 200,
                  actual: 404,
                },
              ],
              httpTransactions: [
                {
                  request: {
                    origin: 'https://api.example.com',
                    path: '/orders/8f3a2c',
                    method: 'GET',
                    headers: { Authorization: 'Bearer redacted' },
                  },
                  response: {
                    statusCode: 404,
                    headers: { 'Content-Type': 'application/json' },
                    body: '{ "error": "order not found" }',
                    trailers: {},
                    duration: 12,
                  },
                },
              ],
            }),
          ],
        }),
        createTestCaseExecution({
          name: 'DELETE /orders/{id} skipped',
          status: { kind: 'skipped' },
          steps: [],
        }),
      ],
    }),
  ]);

  it('omits passed cases and headings failed/skipped cases (AC9)', async () => {
    const output = await render(report);

    expect(output).not.toContain('GET /pets returns 200');
    expect(output).toContain('### Create order then fetch it · _✖ failed_');
    expect(output).toContain('### DELETE /orders/{id} skipped · _⏭ skipped_');
  });

  it('renders the outer summary with resolved severity (AC10)', async () => {
    const output = await render(report);

    expect(output).toContain(
      '<summary>error · <code>order-lifecycle</code> · The created order could not be retrieved.</summary>',
    );
  });

  it('renders every step with one row per finding (AC11)', async () => {
    const output = await render(report);

    expect(output).toContain('**Step 1** · POST /orders');
    expect(output).toContain(
      '| passed | Create returns 201 | Response status is 201. |',
    );
    expect(output).toContain('**Step 2** · GET /orders/{id}');
    expect(output).toContain('— expected: 200, actual: 404');
    expect(output.match(/\| failed \| Fetch returns 200 \|/)).not.toBeNull();
  });

  it('nests a balanced HTTP transaction details block (AC12)', async () => {
    const output = await render(report);

    expect(output).toContain('<details><summary>HTTP transaction</summary>');
    expect(output).toContain('```http');
    expect(output).toContain('GET /orders/8f3a2c HTTP/1.1');
    expect(output).toContain('HTTP/1.1 404 Not Found');
    expect((output.match(/<details>/g) ?? []).length).toBe(
      (output.match(/<\/details>/g) ?? []).length,
    );
  });
});

describe('MarkdownFormatter location fallback (AC13)', () => {
  it('falls back to the raw format:{elementId} string when no graph is present', async () => {
    const report = createReport([
      createToolRun({
        tool: { name: '@thymian/plugin-http-linter' },
        runType: 'lint',
        executions: [
          createLintExecution({
            location: {
              type: 'thymianFormat',
              elementType: 'node',
              elementId: 'abc123',
              pointer: '',
            },
            status: { kind: 'failed', reason: 'x' },
          }),
        ],
      }),
    ]);

    const output = await render(report);

    expect(output).toContain('### format:abc123');
  });
});
