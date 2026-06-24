import { describe, expect, it } from 'vitest';

import { ThymianFormat } from '../src/index.js';
import {
  createReport,
  createToolRun,
  executionsFromRunRulesResult,
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

  describe('executionsFromRunRulesResult', () => {
    const rule = httpRule('rfc9110/example')
      .severity('error')
      .type('analytics')
      .summary('Example summary')
      .rule(() => undefined)
      .done();
    const format = new ThymianFormat();

    it('maps a violation to a rule-violation finding', () => {
      const executions = executionsFromRunRulesResult(
        {
          'rfc9110/example': {
            diagnostics: undefined,
            ruleFnResult: [
              {
                location: 'custom/loc',
                violation: { message: 'boom' },
                findings: [],
              },
            ],
          },
        },
        [rule],
        format,
      );

      expect(executions).toHaveLength(1);
      expect(executions[0]?.children).toHaveLength(1);
      expect(executions[0]?.children?.[0]?.findings).toEqual([
        expect.objectContaining({
          kind: 'rule-violation',
          title: 'rfc9110/example',
          severity: 'error',
          ruleId: 'rfc9110/example',
          message: { text: 'boom' },
        }),
      ]);
    });

    it('surfaces findings on a passing result with no violation (Requirement 2)', () => {
      const executions = executionsFromRunRulesResult(
        {
          'rfc9110/example': {
            diagnostics: undefined,
            ruleFnResult: [
              {
                location: 'custom/loc',
                findings: [{ kind: 'assertion-success', title: 'ok' }],
              },
            ],
          },
        },
        [rule],
        format,
      );

      expect(executions).toHaveLength(1);
      expect(executions[0]?.children).toHaveLength(1);
      expect(executions[0]?.children?.[0]?.findings).toEqual([
        expect.objectContaining({ kind: 'assertion-success', title: 'ok' }),
      ]);
    });

    it('combines a violation with its findings on the same result', () => {
      const executions = executionsFromRunRulesResult(
        {
          'rfc9110/example': {
            diagnostics: undefined,
            ruleFnResult: [
              {
                location: 'custom/loc',
                violation: { message: 'boom' },
                findings: [{ kind: 'assertion-failure', title: 'bad' }],
              },
            ],
          },
        },
        [rule],
        format,
      );

      expect(executions).toHaveLength(1);
      expect(executions[0]?.children).toHaveLength(1);
      expect(executions[0]?.children?.[0]?.findings).toHaveLength(2);
      expect(executions[0]?.children?.[0]?.findings.map((f) => f.kind)).toEqual(
        ['rule-violation', 'assertion-failure'],
      );
    });

    it('emits an empty parent but no child for a pure-pass result', () => {
      const executions = executionsFromRunRulesResult(
        {
          'rfc9110/example': {
            diagnostics: undefined,
            ruleFnResult: [{ location: 'custom/loc', findings: [] }],
          },
        },
        [rule],
        format,
      );

      expect(executions).toHaveLength(1);
      expect(executions[0]?.children).toHaveLength(0);
    });

    it('falls back to the rule summary when the violation has no message', () => {
      const executions = executionsFromRunRulesResult(
        {
          'rfc9110/example': {
            diagnostics: undefined,
            ruleFnResult: [
              { location: 'custom/loc', violation: {}, findings: [] },
            ],
          },
        },
        [rule],
        format,
      );

      expect(executions[0]?.children?.[0]?.findings[0]).toMatchObject({
        kind: 'rule-violation',
        title: 'rfc9110/example',
        message: { text: 'Example summary' },
      });
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

      expect(rulesToRuleDescriptors([rule], (r) => r.testRule)).toEqual([
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

      expect(rulesToRuleDescriptors([rule], (r) => r.testRule)).toEqual([
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
        rulesToRuleDescriptors(
          [offRule, informationalRule, activeRule],
          (r) => r.testRule,
        ),
      ).toEqual([{ id: 'rfc9110/active', severity: 'hint' }]);
    });

    it('excludes rules that the adapter mode does not run', () => {
      const staticOnlyRule = httpRule('rfc9110/static-only')
        .severity('warn')
        .type('static')
        .rule(() => undefined)
        .done();
      const testRule = httpRule('rfc9110/test-only')
        .severity('error')
        .type('test')
        .rule(() => undefined)
        .done();

      expect(
        rulesToRuleDescriptors([staticOnlyRule, testRule], (r) => r.testRule),
      ).toEqual([{ id: 'rfc9110/test-only', severity: 'error' }]);
    });
  });
});
