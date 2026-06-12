import { describe, expect, it } from 'vitest';

import {
  createReport,
  createToolRun,
  httpTestResultToRuleFindings,
  rulesToRuleDescriptors,
} from '../src/report/index.js';
import { httpRule } from '../src/rules/rule-builder.js';

describe('report builders', () => {
  it('creates reports and tool runs with generated identifiers', () => {
    const run = createToolRun({
      tool: { name: 'tool' },
      runType: 'lint',
      executions: [],
    });

    const report = createReport([run]);

    expect(run.runId).toBeTruthy();
    expect(run.runAt).toContain('T');
    expect(report.reportId).toBeTruthy();
  });

  it('maps http test results to v4 findings', () => {
    const findings = httpTestResultToRuleFindings([
      {
        type: 'assertion-failure',
        message: 'status should match',
        expected: 200,
        actual: 500,
      },
      {
        type: 'skip',
        message: 'skipped case',
        reason: 'missing dependency',
      },
    ]);

    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      kind: 'assertion-failure',
      severity: 'error',
    });
    expect(findings[1]).toMatchObject({
      kind: 'test-case-skip',
      severity: 'info',
    });
  });

  describe('rulesToRuleDescriptors', () => {
    it('maps rule metadata to rule descriptors', () => {
      const rule = httpRule('rfc9110/example')
        .severity('warn')
        .type('static', 'test')
        .description('Longer rule description')
        .summary('Short summary')
        .explanation('Detailed explanation')
        .url('https://example.com/docs/example')
        .rule(() => undefined)
        .done();

      expect(rulesToRuleDescriptors([rule])).toEqual([
        {
          id: 'rfc9110/example',
          severity: 'warn',
          description: { text: 'Longer rule description' },
          summary: { text: 'Short summary' },
          explanation: { text: 'Detailed explanation' },
          helpUri: 'https://example.com/docs/example',
        },
      ]);
    });

    it('omits optional descriptor fields that are not set on the rule', () => {
      const rule = httpRule('rfc9110/minimal')
        .severity('error')
        .type('test')
        .rule(() => undefined)
        .done();

      expect(rulesToRuleDescriptors([rule])).toEqual([
        { id: 'rfc9110/minimal', severity: 'error' },
      ]);
    });

    it('filters rules that are turned off or informational-only', () => {
      const offRule = httpRule('rfc9110/disabled')
        .severity('off')
        .type('test')
        .rule(() => undefined)
        .done();
      const informationalRule = httpRule('rfc9110/info-only')
        .severity('warn')
        .type('informational')
        .done();
      const activeRule = httpRule('rfc9110/active')
        .severity('hint')
        .type('test')
        .rule(() => undefined)
        .done();

      expect(
        rulesToRuleDescriptors([offRule, informationalRule, activeRule]),
      ).toEqual([{ id: 'rfc9110/active', severity: 'hint' }]);
    });
  });
});
