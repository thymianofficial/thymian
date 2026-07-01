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

import { analyze } from '../src/formatter.js';
import { reportToCsvLines } from '../src/formatters/csv.js';
import { MarkdownFormatter } from '../src/formatters/markdown.js';
import { TextFormatter } from '../src/formatters/text.js';

const rules: RuleDescriptor[] = [
  {
    id: 'rfc9110/host',
    severity: 'error',
    name: 'Host header required',
    summary: { text: 'Requests must carry a Host header' },
    helpUri: 'https://example.com/rules/host',
  },
];

// A lint run (failed/passed/skipped executions) plus a test run whose cases
// carry their outcome as `status` and their detail on step findings.
const report = createReport([
  createToolRun({
    tool: { name: '@thymian/plugin-http-linter' },
    runType: 'lint',
    rules,
    executions: [
      createLintExecution({
        location: { type: 'custom', value: 'GET /pets' },
        ruleId: 'rfc9110/host',
        status: { kind: 'failed', reason: 'Missing Host header' },
      }),
      createLintExecution({
        location: { type: 'custom', value: 'GET /cats' },
        ruleId: 'rfc9110/host',
        status: { kind: 'passed' },
        findings: [{ id: 'info-1', kind: 'informational', title: 'noted' }],
      }),
      createLintExecution({
        location: { type: 'custom', value: 'GET /dogs' },
        ruleId: 'rfc9110/host',
        status: { kind: 'skipped', reason: 'rule disabled in config' },
      }),
    ],
  }),
  createToolRun({
    tool: { name: '@thymian/plugin-http-tester' },
    runType: 'test',
    rules,
    executions: [
      createTestCaseExecution({
        name: 'GET /pets returns 200',
        ruleId: 'rfc9110/host',
        status: { kind: 'passed', durationMilliseconds: 12 },
        steps: [
          createTestStep({
            name: 'Step 1',
            location: { type: 'custom', value: 'GET /pets' },
            findings: [
              { id: 'as-1', kind: 'assertion-success', title: 'status is 200' },
            ],
          }),
        ],
      }),
      createTestCaseExecution({
        name: 'POST /pets fails',
        ruleId: 'rfc9110/host',
        status: {
          kind: 'failed',
          reason: 'assertion failed',
          durationMilliseconds: 34,
        },
        steps: [
          createTestStep({
            name: 'Step 1',
            location: { type: 'custom', value: 'POST /pets' },
            findings: [
              {
                id: 'af-1',
                kind: 'assertion-failure',
                title: 'status mismatch',
                expected: 200,
                actual: 500,
              },
            ],
          }),
        ],
      }),
      createTestCaseExecution({
        name: 'DELETE /pets skipped',
        ruleId: 'rfc9110/host',
        status: { kind: 'skipped', reason: 'no auth token' },
        steps: [],
      }),
    ],
  }),
]);

describe('analyze statistics (AC11)', () => {
  it('counts statuses, resolved severities and surviving finding kinds', () => {
    const { statistics } = analyze([report]);

    // passed: lint /cats + test GET; failed: lint /pets + test POST;
    // skipped: lint /dogs + test DELETE.
    expect(statistics.statusCounts).toEqual({
      passed: 2,
      failed: 2,
      skipped: 2,
    });
    // Each failed execution counted once at its resolved severity (host=error).
    expect(statistics.severityCounts).toEqual({
      error: 2,
      warn: 0,
      hint: 0,
      info: 0,
    });
    // Only surviving finding kinds remain.
    expect(statistics.kindCounts).toEqual({
      informational: 1,
      'assertion-success': 1,
      'assertion-failure': 1,
    });
    expect(statistics.numberOfFindings).toBe(3);
  });
});

describe('TextFormatter rendering (AC13)', () => {
  it('renders execution status, rule id and step findings', async () => {
    const formatter = new TextFormatter();
    formatter.init({ summaryOnly: false });
    formatter.report(report);

    const output = (await formatter.flush()) ?? '';

    expect(output).toContain('rfc9110/host');
    expect(output).toContain('failed: Missing Host header');
    expect(output).toContain('skipped: rule disabled in config');
    expect(output).toContain('skipped: no auth token');
    expect(output).toContain('expected: 200');
    expect(output).toContain('actual: 500');
    expect(output).toContain('status is 200');
    expect(output).toContain('GET /pets returns 200');
    expect(output).toContain('Summary: 2 error(s)');
  });
});

describe('CSV flattening (AC13)', () => {
  it('emits a row per execution and per finding', () => {
    const lines = reportToCsvLines(report);

    // A failed lint execution keeps a row even though it has no findings.
    const failedExecution = lines.find(
      (l) => l.includes(',execution,failed,') && l.includes('GET /pets'),
    );
    expect(failedExecution).toBeDefined();
    expect(failedExecution).toContain('error');

    // The assertion-failure finding carries its expected/actual detail.
    const assertion = lines.find((l) => l.includes('af-1'));
    expect(assertion).toContain('finding');
    expect(assertion).toContain('expected=200');
  });
});

describe('MarkdownFormatter rendering (AC13)', () => {
  it('renders status rows and finding detail columns', async () => {
    const formatter = new MarkdownFormatter(new NoopLogger());
    formatter.init({ path: join(process.cwd(), 'tmp', 'hierarchical.md') });
    formatter.report(report);

    const output = (await formatter.flush()) ?? '';

    expect(output).toContain(
      '| Location | Rule | Status | Severity | Kind | Title | Message | Details |',
    );
    expect(output).toContain('expected: 200; actual: 500');
    expect(output).toContain('Found 2 error(s)');
  });
});
