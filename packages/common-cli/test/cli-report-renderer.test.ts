import { ThymianFormat } from '@thymian/core';
import { afterEach, describe, expect, it } from 'vitest';

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
      label: '',
      type: 'http-request',
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

  it('renders assertion expected/actual details and drops superseded kinds', () => {
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
                    actual: 201,
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

    // Assertion failures render their title plus the expected/actual details
    // that are present; missing fields are omitted cleanly.
    expect(output).toContain('✖ expected status');
    expect(output).toContain('expected: 200');
    expect(output).toContain('actual: 201');
    expect(output).toContain('✖ expected content type');
    // Superseded/unknown finding kinds are not rendered at all.
    expect(output).not.toContain('legacy rule failure');
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

  describe('--sort-reports-by grouping', () => {
    const lintReport = {
      reportId: 'report-1',
      createdAt: new Date().toISOString(),
      runs: [
        {
          runId: 'run-1',
          tool: { name: '@thymian/plugin-http-linter' },
          runType: 'lint' as const,
          runAt: new Date().toISOString(),
          rules: [
            { id: 'alpha/rule', severity: 'warn' as const },
            { id: 'beta/rule', severity: 'error' as const },
          ],
          executions: [
            {
              kind: 'lint' as const,
              ruleId: 'beta/rule',
              status: { kind: 'failed' as const, reason: 'e1' },
              location: { type: 'custom' as const, value: 'GET /a' },
              findings: [],
            },
            {
              kind: 'lint' as const,
              ruleId: 'alpha/rule',
              status: { kind: 'failed' as const, reason: 'w1' },
              location: { type: 'custom' as const, value: 'POST /b' },
              findings: [],
            },
            {
              kind: 'lint' as const,
              status: { kind: 'failed' as const, reason: 'orphan' },
              location: { type: 'custom' as const, value: 'GET /c' },
              findings: [],
            },
          ],
        },
      ],
    };

    const headingLine = (output: string, key: string): number =>
      output.split('\n').findIndex((line) => line === `  ${key}`);

    it('endpoint (default) groups by resolved location, alphabetically', () => {
      const output = stripAnsi(renderReport(lintReport));

      // A location-less rule is grouped under its endpoint, sorted A→Z.
      expect(headingLine(output, 'GET /a')).toBeGreaterThanOrEqual(0);
      expect(headingLine(output, 'GET /c')).toBeGreaterThan(
        headingLine(output, 'GET /a'),
      );
      expect(headingLine(output, 'POST /b')).toBeGreaterThan(
        headingLine(output, 'GET /c'),
      );
    });

    it('rule mode: severity+rule heading with count, per-violation location and reason', () => {
      const output = stripAnsi(
        renderReport(lintReport, { sortReportsBy: 'rule' }),
      );

      // Headings show the rule's severity, the rule id, and a violation count;
      // groups sort alphabetically by rule id.
      expect(output).toContain('⚠ warn: alpha/rule');
      expect(output).toContain('✖ error: beta/rule');
      expect(output).toContain('✖ error: unnamed check'); // ruleless fallback
      expect(output.indexOf('alpha/rule')).toBeLessThan(
        output.indexOf('beta/rule'),
      );
      expect(output.indexOf('beta/rule')).toBeLessThan(
        output.indexOf('unnamed check'),
      );

      // Each violation shows its location (bulleted) then its reason — the
      // location that endpoint grouping used to carry, no longer lost.
      expect(output).toContain('• POST /b');
      expect(output).toContain('➜ w1');
      expect(output).toContain('• GET /a');
      expect(output).toContain('➜ e1');
      expect(output).toContain('• GET /c');
      expect(output).toContain('➜ orphan');
      // The rule is the heading, so it is not repeated per violation.
      expect(output).not.toContain('› beta/rule');
    });

    it('severity mode: pluralized heading (error→warn) with location, rule, reason', () => {
      const output = stripAnsi(
        renderReport(lintReport, { sortReportsBy: 'severity' }),
      );

      // `error` precedes `warn` despite `error` > `warn` alphabetically.
      expect(output).toContain('✖ ERRORS');
      expect(output).toContain('⚠ WARNINGS');
      expect(output.indexOf('✖ ERRORS')).toBeLessThan(
        output.indexOf('⚠ WARNINGS'),
      );

      // Each violation shows its location, reason, and the violated rule.
      expect(output).toContain('• GET /a');
      expect(output).toContain('➜ e1');
      expect(output).toContain('› beta/rule');
      // A ruleless violation still shows location + reason, with no rule ref.
      expect(output).toContain('• GET /c');
      expect(output).toContain('➜ orphan');
    });

    it('severity mode: shows the rule ref even when the rule has no descriptor', () => {
      const output = stripAnsi(
        renderReport(
          {
            reportId: 'report-1',
            createdAt: new Date().toISOString(),
            runs: [
              {
                runId: 'run-1',
                tool: { name: '@thymian/plugin-http-linter' },
                runType: 'lint' as const,
                runAt: new Date().toISOString(),
                rules: [], // no descriptor for `ghost/rule`
                executions: [
                  {
                    kind: 'lint' as const,
                    ruleId: 'ghost/rule',
                    status: {
                      kind: 'failed' as const,
                      severity: 'error' as const,
                      reason: 'boom',
                    },
                    location: { type: 'custom' as const, value: 'GET /a' },
                    findings: [],
                  },
                ],
              },
            ],
          },
          { sortReportsBy: 'severity' },
        ),
      );

      // The ref is derived from execution.ruleId (not the descriptor), so rule
      // identity survives — matching the markdown surface.
      expect(output).toContain('› ghost/rule');
    });

    it('files skipped executions under their own group in severity mode, not error', () => {
      const output = stripAnsi(
        renderReport(
          {
            reportId: 'report-1',
            createdAt: new Date().toISOString(),
            runs: [
              {
                runId: 'run-1',
                tool: { name: '@thymian/plugin-http-linter' },
                runType: 'lint' as const,
                runAt: new Date().toISOString(),
                rules: [{ id: 'beta/rule', severity: 'error' as const }],
                executions: [
                  {
                    kind: 'lint' as const,
                    ruleId: 'beta/rule',
                    status: { kind: 'failed' as const, reason: 'e1' },
                    location: { type: 'custom' as const, value: 'GET /a' },
                    findings: [],
                  },
                  {
                    kind: 'lint' as const,
                    ruleId: 'gamma/rule',
                    status: { kind: 'skipped' as const, reason: 'n/a' },
                    location: { type: 'custom' as const, value: 'GET /b' },
                    findings: [],
                  },
                ],
              },
            ],
          },
          { sortReportsBy: 'severity' },
        ),
      );

      // The skip gets its own heading, ordered after the real severities —
      // never mislabelled under `error`.
      expect(output).toContain('✖ ERRORS');
      expect(output).toContain('⏭ SKIPPED');
      expect(output.indexOf('✖ ERRORS')).toBeLessThan(
        output.indexOf('⏭ SKIPPED'),
      );
      // The skip keeps its location + reason.
      expect(output).toContain('skipped: GET /b');
      expect(output).toContain('➜ n/a');
    });

    it('keeps each test case name visible when regrouped by rule', () => {
      const testReport = {
        reportId: 'report-1',
        createdAt: new Date().toISOString(),
        runs: [
          {
            runId: 'run-1',
            tool: { name: '@thymian/plugin-http-tester' },
            runType: 'test' as const,
            runAt: new Date().toISOString(),
            rules: [{ id: 'shared/rule', severity: 'error' as const }],
            executions: [
              {
                kind: 'test' as const,
                ruleId: 'shared/rule',
                status: { kind: 'failed' as const },
                name: 'case alpha',
                steps: [
                  {
                    name: 'Step 1',
                    location: { type: 'custom' as const, value: 'GET /a' },
                    findings: [
                      { id: 'f-1', kind: 'assertion-failure', title: 'boom a' },
                    ],
                  },
                ],
              },
              {
                kind: 'test' as const,
                ruleId: 'shared/rule',
                status: { kind: 'failed' as const },
                name: 'case beta',
                steps: [
                  {
                    name: 'Step 1',
                    location: { type: 'custom' as const, value: 'GET /b' },
                    findings: [
                      { id: 'f-2', kind: 'assertion-failure', title: 'boom b' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const output = stripAnsi(
        renderReport(testReport, { sortReportsBy: 'rule' }),
      );

      // One rule heading (error severity, 2 cases); each case shown by name.
      expect(output).toContain('✖ error: shared/rule');
      expect(output).toContain('• case alpha');
      expect(output).toContain('• case beta');
      expect(output.indexOf('shared/rule')).toBeLessThan(
        output.indexOf('case alpha'),
      );
      // Findings still render beneath each case.
      expect(output).toContain('✖ boom a');
    });
  });

  describe('wraps long leaf prose while preserving indentation and tree alignment', () => {
    const originalColumns = process.env.OCLIF_COLUMNS;

    afterEach(() => {
      if (originalColumns === undefined) {
        delete process.env.OCLIF_COLUMNS;
      } else {
        process.env.OCLIF_COLUMNS = originalColumns;
      }
    });

    it('hang-indents a long multi-step finding under its tree branch', () => {
      process.env.OCLIF_COLUMNS = '50';

      const longTitle =
        'the response body did not match the expected schema and this message is deliberately long enough to force wrapping';

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
                          title: 'ok',
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
                          title: longTitle,
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

      const lines = output.split('\n');

      // Prose lines stay within the pinned 50-col width. The run-heading
      // separator (`tool · type · ────`) is a fixed-shape divider, not wrapped
      // prose, so it is exempt.
      for (const line of lines) {
        if (line.includes('·')) {
          continue;
        }
        expect(line.length).toBeLessThanOrEqual(50);
      }

      // The finding wrapped onto more than one line.
      const firstFindingLineIdx = lines.findIndex((line) =>
        line.includes('✖ the response body did not'),
      );
      expect(firstFindingLineIdx).toBeGreaterThanOrEqual(0);

      const firstFindingLine = lines[firstFindingLineIdx]!;
      const continuationLine = lines[firstFindingLineIdx + 1]!;

      // The glyph appears on the first line only; continuation hangs under the
      // content column (after `✖ `) and never repeats the glyph.
      const glyphColumn = firstFindingLine.indexOf('✖');
      const contentColumn = glyphColumn + 2; // '✖ '
      expect(continuationLine).not.toContain('✖');
      expect(continuationLine.slice(0, contentColumn)).toBe(
        ' '.repeat(contentColumn),
      );
      expect(continuationLine.trimStart().length).toBeGreaterThan(0);

      // Tree branch glyphs still render for the steps.
      expect(output).toContain('├── Step 1: GET /pets');
      expect(output).toContain('└── Step 2: POST /pets');
    });
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
