import { join } from 'node:path';

import {
  createExecution,
  createReport,
  createToolRun,
  type FindingRecord,
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

const testCasePass: FindingRecord = {
  id: 'tc-pass',
  kind: 'test-case-pass',
  title: 'GET /pets returns 200',
  severity: 'info',
  durationMilliseconds: 12,
  nestedFindings: [
    {
      type: 'composed-of',
      finding: {
        id: 'assert-ok',
        kind: 'assertion-success',
        title: 'status is 200',
        severity: 'info',
      },
    },
  ],
};

// endpoint -> rule -> test-case, exercising the full kind set across the tree.
const report = createReport([
  createToolRun({
    tool: { name: '@thymian/plugin-http-tester' },
    runType: 'test',
    rules,
    executions: [
      createExecution({
        location: { type: 'custom', value: 'GET /pets' },
        findings: [
          {
            id: 'rv-1',
            kind: 'rule-violation',
            ruleId: 'rfc9110/host',
            title: 'Missing Host header',
            severity: 'error',
            message: { text: 'Missing Host header' },
          },
          {
            id: 'rs-1',
            kind: 'rule-success',
            ruleId: 'rfc9110/host',
            title: 'Host header present',
            severity: 'info',
          },
          {
            id: 'rskip-1',
            kind: 'rule-skip',
            ruleId: 'rfc9110/host',
            title: 'Rule skipped',
            severity: 'hint',
            reason: 'rule disabled in config',
          } as FindingRecord,
        ],
        children: [
          createExecution({
            location: { type: 'custom', value: 'rfc9110/host' },
            findings: [],
            children: [
              createExecution({
                location: { type: 'custom', value: 'case: happy path' },
                findings: [
                  testCasePass,
                  {
                    id: 'tc-fail',
                    kind: 'test-case-fail',
                    title: 'POST /pets fails',
                    severity: 'error',
                    durationMilliseconds: 34,
                  } as FindingRecord,
                  {
                    id: 'tc-skip',
                    kind: 'test-case-skip',
                    title: 'DELETE /pets skipped',
                    severity: 'info',
                    reason: 'no auth token',
                  } as FindingRecord,
                  {
                    id: 'af-1',
                    kind: 'assertion-failure',
                    title: 'status mismatch',
                    severity: 'error',
                    expected: 200,
                    actual: 500,
                  } as FindingRecord,
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  }),
]);

describe('analyze with kindCounts', () => {
  it('counts findings per kind across the full tree including nested', () => {
    const { statistics } = analyze([report]);

    expect(statistics.kindCounts).toMatchObject({
      'rule-violation': 1,
      'rule-success': 1,
      'rule-skip': 1,
      'test-case-pass': 1,
      'test-case-fail': 1,
      'test-case-skip': 1,
      'assertion-failure': 1,
      'assertion-success': 1,
    });
    // 7 direct findings + 1 nested assertion-success.
    expect(statistics.numberOfFindings).toBe(8);
  });
});

describe('TextFormatter hierarchical rendering', () => {
  it('renders all kinds, rule metadata, nested findings and deep executions', async () => {
    const formatter = new TextFormatter();
    formatter.init({ summaryOnly: false });
    formatter.report(report);

    const output = (await formatter.flush()) ?? '';

    // rule attribution + descriptor enrichment
    expect(output).toContain('rule: rfc9110/host');
    expect(output).toContain('rule name: Host header required');
    expect(output).toContain('help: https://example.com/rules/host');
    // per-kind detail
    expect(output).toContain('reason: rule disabled in config');
    expect(output).toContain('expected: 200');
    expect(output).toContain('actual: 500');
    expect(output).toContain('duration: 12ms');
    // previously unrendered kinds
    expect(output).toContain('Host header present');
    expect(output).toContain('GET /pets returns 200');
    // deep execution location (depth 2) and nested assertion
    expect(output).toContain('case: happy path');
    expect(output).toContain('status is 200');
  });
});

describe('CSV hierarchical flattening', () => {
  it('emits depth, nested_depth and parent_finding_id columns', () => {
    const lines = reportToCsvLines(report);

    const nested = lines.find((l) => l.includes('assert-ok'));
    expect(nested).toBeDefined();
    // nested_depth 1, parent test-case id present
    expect(nested).toContain(',1,tc-pass,');

    const skip = lines.find((l) => l.includes('rskip-1'));
    expect(skip).toContain('reason=rule disabled in config');
  });
});

describe('MarkdownFormatter hierarchical rendering', () => {
  it('renders nested findings with an indent marker and a details column', async () => {
    const formatter = new MarkdownFormatter(new NoopLogger());
    formatter.init({ path: join(process.cwd(), 'tmp', 'hierarchical.md') });
    formatter.report(report);

    const output = (await formatter.flush()) ?? '';

    expect(output).toContain('| Location | Severity | Kind | Title | Rule | Message | Details |');
    expect(output).toContain('↳ status is 200');
    expect(output).toContain('expected: 200; actual: 500');
  });
});
