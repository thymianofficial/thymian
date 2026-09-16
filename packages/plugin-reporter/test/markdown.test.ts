import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import {
  createAnalyzeExecution,
  createLintExecution,
  createReport,
  createTestCaseExecution,
  createTestStep,
  createToolRun,
  NoopLogger,
  type RuleDescriptor,
} from '@thymian/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { MarkdownFormatter } from '../src/formatters/markdown.js';
import { defaultRunDirectoryName } from '../src/report-file-name.js';
import {
  errorSymbol,
  hintSymbol,
  infoSymbol,
  skippedSymbol,
  successSymbol,
  warnSymbol,
} from '../src/style.js';

/**
 * Scratch base for the rendering tests. There is no per-formatter output path
 * any more, so rendering means writing a real file: each render gets its own
 * `cwd` beneath this directory, and the whole tree is wiped once per run.
 */
const RENDER_BASE = join(process.cwd(), 'tmp', 'markdown-render');

let renderCounter = 0;

beforeAll(async () => {
  await rm(RENDER_BASE, { recursive: true, force: true });
});

async function renderWith(
  report: ReturnType<typeof createReport>,
  sortReportsBy?: 'rule' | 'endpoint' | 'severity',
): Promise<string> {
  const formatter = new MarkdownFormatter(new NoopLogger());
  formatter.init({
    cwd: join(RENDER_BASE, `render-${renderCounter++}`),
    sortReportsBy,
  });
  await formatter.report(report);

  return (await formatter.flush()) ?? '';
}

function render(report: ReturnType<typeof createReport>): Promise<string> {
  return renderWith(report);
}

function renderSorted(
  report: ReturnType<typeof createReport>,
  sortReportsBy: 'rule' | 'endpoint' | 'severity',
): Promise<string> {
  return renderWith(report, sortReportsBy);
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
    expect(output).toContain(
      '| warning | <code>content-type-charset</code> | msg |',
    );
    expect(output).toContain(
      '| info | <code>content-type-charset</code> | auth-scheme deprecated |',
    );
    expect(output).toContain('### GET /widgets');
    expect(output).toContain('| error | <code>unnamed check</code> | broken |');
  });

  it('omits passed executions with no findings and their location (AC7)', async () => {
    const output = await render(report);

    expect(output).not.toContain('### GET /pets');
  });

  it('escapes a helpUri containing `)` so the table row is not corrupted', async () => {
    const helpUri = 'https://x/rules?a=1)&b=2';
    const linkedReport = createReport([
      createToolRun({
        tool: { name: '@thymian/plugin-http-linter' },
        runType: 'lint',
        rules: [{ id: 'tricky-uri', severity: 'error', helpUri }],
        executions: [
          createLintExecution({
            location: { type: 'custom', value: 'GET /x' },
            ruleId: 'tricky-uri',
            status: { kind: 'failed', reason: 'boom' },
          }),
        ],
      }),
    ]);

    const output = await render(linkedReport);

    // Rendered as an HTML anchor (not a markdown `[text](url)` link), so the
    // `)` stays inside the href instead of truncating the link and leaking the
    // rest of the URL into the table row.
    expect(output).toContain(
      `| error | <a href="${helpUri.replaceAll('&', '&amp;')}"><code>tricky-uri</code></a> | boom |`,
    );
    // The corrupt markdown-link form must not appear.
    expect(output).not.toContain(`](${helpUri})`);
  });
});

describe('MarkdownFormatter lint/analyze assertion-failure findings', () => {
  it('renders assertion-failure findings as failed rows with expected/actual (BaggersIO PR-311 finding 2)', async () => {
    const report = createReport([
      createToolRun({
        tool: { name: '@thymian/plugin-http-analyzer' },
        runType: 'analyze',
        rules: [{ id: 'schema-conforms', severity: 'error' }],
        executions: [
          createAnalyzeExecution({
            location: { type: 'custom', value: 'POST /orders' },
            ruleId: 'schema-conforms',
            status: { kind: 'failed', reason: '1 assertion(s) failed' },
            findings: [
              {
                id: 'af-1',
                kind: 'assertion-failure',
                title: 'status code',
                message: { text: 'unexpected status code' },
                expected: 200,
                actual: 404,
              },
              {
                id: 'as-1',
                kind: 'assertion-success',
                title: 'headers',
                message: { text: 'headers ok' },
              },
            ],
          }),
        ],
      }),
    ]);

    const output = await render(report);

    expect(output).toContain(
      '| failed | <code>schema-conforms</code> | unexpected status code — expected: 200, actual: 404 |',
    );
    // assertion-success stays omitted, consistent with the omit-passed policy.
    expect(output).not.toContain('headers ok');
  });

  it('omits the expected/actual suffix entirely when both are undefined (regression for #7)', async () => {
    const report = createReport([
      createToolRun({
        tool: { name: '@thymian/plugin-http-analyzer' },
        runType: 'analyze',
        rules: [{ id: 'schema-conforms', severity: 'error' }],
        executions: [
          createAnalyzeExecution({
            location: { type: 'custom', value: 'POST /orders' },
            ruleId: 'schema-conforms',
            status: { kind: 'failed', reason: '1 assertion(s) failed' },
            findings: [
              {
                id: 'af-2',
                kind: 'assertion-failure',
                title: 'no detail',
                message: { text: 'missing required header' },
              },
            ],
          }),
        ],
      }),
    ]);

    const output = await render(report);

    expect(output).toContain(
      '| failed | <code>schema-conforms</code> | missing required header |',
    );
    expect(output).not.toContain('undefined');
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

describe('MarkdownFormatter --sort-reports-by grouping', () => {
  const lintRules: RuleDescriptor[] = [
    { id: 'alpha/rule', severity: 'warn' },
    { id: 'beta/rule', severity: 'error' },
  ];

  const lintReport = createReport([
    createToolRun({
      tool: { name: '@thymian/plugin-http-linter' },
      runType: 'lint',
      rules: lintRules,
      executions: [
        failedLint('GET /a', { ruleId: 'beta/rule', reason: 'e1' }),
        failedLint('POST /b', { ruleId: 'alpha/rule', reason: 'w1' }),
        failedLint('GET /c', { reason: 'orphan' }),
      ],
    }),
  ]);

  it('groups lint rows by rule (mirrored heading), adding a Location column', async () => {
    const output = await renderSorted(lintReport, 'rule');

    // Headings mirror the CLI: severity symbol + severity + rule id + count.
    expect(output).toContain('### ⚠ warn: alpha/rule');
    expect(output).toContain('### ✖ error: beta/rule');
    expect(output).toContain('### ✖ error: unnamed check'); // ruleless fallback
    expect(output.indexOf('alpha/rule')).toBeLessThan(
      output.indexOf('beta/rule'),
    );
    expect(output.indexOf('beta/rule')).toBeLessThan(
      output.indexOf('unnamed check'),
    );

    // Location is now a column (no longer lost); Severity and Rule are dropped
    // because the heading already carries both.
    expect(output).toContain('| Location | Message |');
    expect(output).toContain('| POST /b | w1 |');
    expect(output).toContain('| GET /a | e1 |');
    expect(output).not.toContain('| Severity | Location | Message |');
  });

  it('groups lint rows by severity (error→warn), adding a Location column', async () => {
    const output = await renderSorted(lintReport, 'severity');

    expect(output).toContain('### ✖ ERRORS');
    expect(output).toContain('### ⚠ WARNINGS');
    expect(output.indexOf('### ✖ ERRORS')).toBeLessThan(
      output.indexOf('### ⚠ WARNINGS'),
    );

    // Rule + Location columns; the Severity column (now the heading) is dropped.
    expect(output).toContain('| Rule | Location | Message |');
    expect(output).toContain('| <code>beta/rule</code> | GET /a | e1 |');
    expect(output).toContain('| <code>alpha/rule</code> | POST /b | w1 |');
  });

  it('files skipped executions under a dedicated group in severity mode', async () => {
    const report = createReport([
      createToolRun({
        tool: { name: '@thymian/plugin-http-linter' },
        runType: 'lint',
        rules: [{ id: 'beta/rule', severity: 'error' }],
        executions: [
          failedLint('GET /a', { ruleId: 'beta/rule', reason: 'e1' }),
          createLintExecution({
            location: { type: 'custom', value: 'GET /b' },
            ruleId: 'gamma/rule',
            status: { kind: 'skipped', reason: 'n/a' },
          }),
        ],
      }),
    ]);

    const output = await renderSorted(report, 'severity');

    expect(output).toContain('### ✖ ERRORS');
    expect(output).toContain('### ⏭ SKIPPED');
    // Skipped sorts after the real severities, never merged into `error`.
    expect(output.indexOf('### ✖ ERRORS')).toBeLessThan(
      output.indexOf('### ⏭ SKIPPED'),
    );
    // The skip keeps its location in the added column.
    expect(output).toContain('| <code>gamma/rule</code> | GET /b | n/a |');
  });

  it('excludes passed executions (and their info findings) from rule/severity groups', async () => {
    const report = createReport([
      createToolRun({
        tool: { name: '@thymian/plugin-http-linter' },
        runType: 'lint',
        rules: [{ id: 'hinty', severity: 'hint' }],
        executions: [
          createLintExecution({
            location: { type: 'custom', value: 'GET /passed' },
            ruleId: 'hinty',
            status: { kind: 'passed' },
            findings: [
              {
                id: 'i-1',
                kind: 'informational',
                title: 'fyi',
                message: { text: 'fyi detail' },
              },
            ],
          }),
        ],
      }),
    ]);

    // severity mode: only a passed execution exists, so there is nothing to
    // group — no bogus `### ✖ ERRORS (0)` heading and no mis-filed info row.
    const severity = await renderSorted(report, 'severity');
    expect(severity).not.toContain('ERRORS');
    expect(severity).not.toContain('fyi detail');

    // rule mode: the passed execution contributes no group at all.
    const rule = await renderSorted(report, 'rule');
    expect(rule).not.toContain('hinty');
    expect(rule).not.toContain('fyi detail');

    // endpoint mode still surfaces the informational finding under its location.
    const endpoint = await render(report);
    expect(endpoint).toContain('### GET /passed');
    expect(endpoint).toContain('fyi detail');
  });

  it('rule heading falls back to the execution severity when the rule has no descriptor', async () => {
    const report = createReport([
      createToolRun({
        tool: { name: '@thymian/plugin-http-linter' },
        runType: 'lint',
        rules: [], // no descriptor for `ghost/rule`
        executions: [
          createLintExecution({
            location: { type: 'custom', value: 'GET /a' },
            ruleId: 'ghost/rule',
            status: { kind: 'failed', severity: 'warn', reason: 'w' },
          }),
        ],
      }),
    ]);

    const output = await renderSorted(report, 'rule');
    // Severity resolved from the execution (status.severity), matching the CLI
    // `ruleHeading`/`groupSeverity` fallback — not the hardcoded `error`.
    expect(output).toContain('### ⚠ warn: ghost/rule');
    expect(output).not.toContain('error: ghost/rule');
  });

  it('escapes HTML metacharacters in a rule id used as a heading', async () => {
    const report = createReport([
      createToolRun({
        tool: { name: '@thymian/plugin-http-linter' },
        runType: 'lint',
        rules: [{ id: 'x/<b>oops</b>', severity: 'error' }],
        executions: [
          failedLint('GET /a', { ruleId: 'x/<b>oops</b>', reason: 'boom' }),
        ],
      }),
    ]);

    const output = await renderSorted(report, 'rule');
    expect(output).toContain('### ✖ error: x/&lt;b&gt;oops&lt;/b&gt;');
    expect(output).not.toContain('### ✖ error: x/<b>oops</b>');
  });

  it('regroups test cases under a rule heading with #### sub-headings', async () => {
    const testReport = createReport([
      createToolRun({
        tool: { name: '@thymian/plugin-http-tester' },
        runType: 'test',
        rules: [{ id: 'shared/rule', severity: 'error' }],
        executions: [
          createTestCaseExecution({
            name: 'case a',
            ruleId: 'shared/rule',
            status: { kind: 'failed', reason: 'boom a' },
            steps: [],
          }),
          createTestCaseExecution({
            name: 'case b',
            ruleId: 'shared/rule',
            status: { kind: 'failed', reason: 'boom b' },
            steps: [],
          }),
        ],
      }),
    ]);

    const ruleOutput = await renderSorted(testReport, 'rule');
    const grouped = ruleOutput.split('\n');
    expect(grouped).toContain('### ✖ error: shared/rule');
    expect(grouped).toContain('#### case a · _✖ failed_');
    expect(grouped).toContain('#### case b · _✖ failed_');
    // The case name is a `####` sub-heading, not a top-level `###` heading.
    expect(grouped.some((line) => line.startsWith('### case a'))).toBe(false);
    // The summary keeps the severity but drops the rule (it is the heading).
    expect(ruleOutput).toContain('<details><summary>error · boom a</summary>');
    expect(ruleOutput).not.toContain('shared/rule</code> · boom a');

    // Grouped by severity: the summary drops the `error · ` prefix (the
    // heading carries the severity) but keeps the rule.
    const severityOutput = await renderSorted(testReport, 'severity');
    expect(severityOutput).toContain('### ✖ ERRORS');
    expect(severityOutput).toContain(
      '<details><summary><code>shared/rule</code> · boom a</summary>',
    );
    expect(severityOutput).not.toContain('error · <code>shared/rule</code>');

    // Default keeps the historical flat, per-case `###` layout, with both the
    // severity and the rule in the summary.
    const flatOutput = await render(testReport);
    const flat = flatOutput.split('\n');
    expect(flat).toContain('### case a · _✖ failed_');
    expect(flat.some((line) => line.startsWith('#### '))).toBe(false);
    expect(flatOutput).toContain(
      '<details><summary>error · <code>shared/rule</code> · boom a</summary>',
    );
  });

  it('files a skipped test case under the skipped severity group', async () => {
    const report = createReport([
      createToolRun({
        tool: { name: '@thymian/plugin-http-tester' },
        runType: 'test',
        rules: [{ id: 'lifecycle', severity: 'error' }],
        executions: [
          createTestCaseExecution({
            name: 'failing case',
            ruleId: 'lifecycle',
            status: { kind: 'failed', reason: 'boom' },
            steps: [],
          }),
          createTestCaseExecution({
            name: 'skipped case',
            ruleId: 'lifecycle',
            status: { kind: 'skipped', reason: 'n/a' },
            steps: [],
          }),
        ],
      }),
    ]);

    const output = await renderSorted(report, 'severity');

    expect(output).toContain('### ✖ ERRORS');
    expect(output).toContain('### ⏭ SKIPPED');
    expect(output.indexOf('### ✖ ERRORS')).toBeLessThan(
      output.indexOf('### ⏭ SKIPPED'),
    );
    // The skipped case lands under SKIPPED, the failing one under ERRORS.
    expect(output).toContain('#### skipped case · _⏭ skipped_');
    expect(output).toContain('#### failing case · _✖ failed_');
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

describe('MarkdownFormatter summary HTML escaping', () => {
  it('escapes HTML-significant characters in the outer <summary> text', async () => {
    const report = createReport([
      createToolRun({
        tool: { name: '@thymian/plugin-http-tester' },
        runType: 'test',
        rules: [{ id: 'r&<>ule', severity: 'error' }],
        executions: [
          createTestCaseExecution({
            name: 'Case with unsafe reason',
            ruleId: 'r&<>ule',
            status: { kind: 'failed', reason: '<b>&"bad"</b>' },
            steps: [],
          }),
        ],
      }),
    ]);

    const output = await render(report);

    expect(output).toContain(
      '<summary>error · <code>r&amp;&lt;&gt;ule</code> · &lt;b&gt;&amp;&quot;bad&quot;&lt;/b&gt;</summary>',
    );
    expect(output).not.toContain('<b>&"bad"</b>');
  });

  it('escapes quotes in a helpUri so it cannot break out of the href attribute', async () => {
    const helpUri = 'https://x/rules"><script>alert(1)</script>';
    const report = createReport([
      createToolRun({
        tool: { name: '@thymian/plugin-http-linter' },
        runType: 'lint',
        rules: [{ id: 'quote-uri', severity: 'error', helpUri }],
        executions: [
          createLintExecution({
            location: { type: 'custom', value: 'GET /x' },
            ruleId: 'quote-uri',
            status: { kind: 'failed', reason: 'boom' },
          }),
        ],
      }),
    ]);

    const output = await render(report);

    // The `"` must be entity-escaped so the attribute value stays intact and
    // the injected `<script>` cannot escape into raw markup.
    expect(output).toContain(
      `<a href="https://x/rules&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"><code>quote-uri</code></a>`,
    );
    expect(output).not.toContain('"><script>alert(1)</script>');
  });
});

describe('MarkdownFormatter derived run directory', () => {
  const lintReport = () =>
    createReport([
      createToolRun({
        tool: { name: '@thymian/plugin-http-linter' },
        runType: 'lint',
        executions: [failedLint('GET /pets')],
      }),
    ]);

  it('writes report.md in a per-run directory under .thymian/reports', async () => {
    const cwd = join(process.cwd(), 'tmp', 'markdown-derived');
    await rm(cwd, { recursive: true, force: true });

    const formatter = new MarkdownFormatter(new NoopLogger());
    formatter.init({ cwd });
    await formatter.report(lintReport());
    await formatter.flush();

    const reportsDir = join(cwd, '.thymian', 'reports');
    const runDirectories = await readdir(reportsDir);
    const [runDirectory = ''] = runDirectories;

    expect(runDirectories).toHaveLength(1);
    // `<stamp>-<shortId>`: both parts non-empty, so a degenerate `-` fails.
    expect(runDirectory).toMatch(/^.+-[A-Za-z0-9]+$/);
    expect(await readdir(join(reportsDir, runDirectory))).toEqual([
      'report.md',
    ]);
  });

  it('gives two reports of one session two run directories', async () => {
    // The `serve` defect: one plugin instance serves every workflow, so a
    // destination pinned on the first report wrote workflow 2 into workflow 1's
    // directory.
    const cwd = join(process.cwd(), 'tmp', 'markdown-two-reports');
    await rm(cwd, { recursive: true, force: true });

    const first = lintReport();
    const second = lintReport();
    const formatter = new MarkdownFormatter(new NoopLogger());
    formatter.init({ cwd });
    await formatter.report(first);
    await formatter.report(second);
    await formatter.flush();

    const reportsDir = join(cwd, '.thymian', 'reports');
    const runDirectories = await readdir(reportsDir);

    expect(runDirectories).toHaveLength(2);
    // Each directory is named from its OWN report, so both ids show up.
    expect(runDirectories.sort()).toEqual(
      [defaultRunDirectoryName(first), defaultRunDirectoryName(second)].sort(),
    );
    for (const runDirectory of runDirectories) {
      expect(await readdir(join(reportsDir, runDirectory))).toEqual([
        'report.md',
      ]);
    }
  });

  it('honours a custom reportsDir, relative to cwd and absolute as-is', async () => {
    const cwd = join(process.cwd(), 'tmp', 'markdown-custom-base');
    await rm(cwd, { recursive: true, force: true });

    const relative = new MarkdownFormatter(new NoopLogger());
    relative.init({ cwd, reportsDir: 'build/rep' });
    await relative.report(lintReport());
    await relative.flush();

    const absoluteBase = join(cwd, 'absolute-base');
    const absolute = new MarkdownFormatter(new NoopLogger());
    absolute.init({ cwd: join(cwd, 'elsewhere'), reportsDir: absoluteBase });
    await absolute.report(lintReport());
    await absolute.flush();

    expect(await readdir(join(cwd, 'build', 'rep'))).toHaveLength(1);
    expect(await readdir(absoluteBase)).toHaveLength(1);
    // A custom base takes over completely — the default one is never touched.
    await expect(readdir(join(cwd, '.thymian'))).rejects.toThrow();
    await expect(readdir(join(cwd, 'elsewhere'))).rejects.toThrow();
  });

  it('writes nothing when no report arrived', async () => {
    const cwd = join(process.cwd(), 'tmp', 'markdown-derived-empty');
    await rm(cwd, { recursive: true, force: true });

    const formatter = new MarkdownFormatter(new NoopLogger());
    formatter.init({ cwd });

    await expect(formatter.flush()).resolves.toBeUndefined();
    await expect(readdir(join(cwd, '.thymian', 'reports'))).rejects.toThrow();
  });
});
