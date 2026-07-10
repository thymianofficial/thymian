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

  it('maps http test results to rule findings (test-case outcomes are status now)', () => {
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
    // `skip`/`timeout`/`invalid-transaction` are dead in the lint/analyze path
    // and map defensively to `informational` (test-case outcomes are `status`).
    expect(findings[1]).toMatchObject({ kind: 'informational' });
  });

  describe('executionsFromRunRulesResult', () => {
    const rule = httpRule('rfc9110/example')
      .severity('error')
      .type('analytics')
      .summary('Example summary')
      .rule(() => undefined)
      .done();
    const format = new ThymianFormat();

    it('maps a violation to a failed status (AC2)', () => {
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
      expect(executions[0]).toMatchObject({
        kind: 'lint',
        ruleId: 'rfc9110/example',
        status: { kind: 'failed', reason: 'boom' },
        findings: [],
      });
      // Severity is not stored on the status; it resolves from the ruleId.
      expect(
        (executions[0]?.status as { severity?: unknown }).severity,
      ).toBeUndefined();
    });

    it('surfaces findings on a passing result with no violation (AC5)', () => {
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
      expect(executions[0]?.status.kind).toBe('passed');
      expect((executions[0] as { findings: unknown[] }).findings).toEqual([
        expect.objectContaining({ kind: 'assertion-success', title: 'ok' }),
      ]);
    });

    it('keeps detail findings alongside a violation status (no synthetic rule-violation)', () => {
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
      expect(executions[0]?.status.kind).toBe('failed');
      const findings = (executions[0] as { findings: { kind: string }[] })
        .findings;
      expect(findings.map((f) => f.kind)).toEqual(['assertion-failure']);
    });

    it('emits a passed execution for a pure-pass result (AC3)', () => {
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
      expect(executions[0]?.status.kind).toBe('passed');
      expect((executions[0] as { findings: unknown[] }).findings).toEqual([]);
    });

    it('maps a rule-skip-only result to a skipped status (AC4)', () => {
      const executions = executionsFromRunRulesResult(
        {
          'rfc9110/example': {
            diagnostics: undefined,
            ruleFnResult: [
              {
                location: 'custom/loc',
                findings: [
                  { kind: 'rule-skip', title: 'skip', reason: 'no endpoint' },
                ],
              },
            ],
          },
        },
        [rule],
        format,
      );

      expect(executions).toHaveLength(1);
      expect(executions[0]?.status).toMatchObject({
        kind: 'skipped',
        reason: 'no endpoint',
      });
      // rule-skip is a producer signal, never a report finding.
      expect((executions[0] as { findings: unknown[] }).findings).toEqual([]);
    });

    it('maps a rule-skip alongside another finding to skipped, not passed (regression, BaggersIO PR-311 finding 10)', () => {
      const executions = executionsFromRunRulesResult(
        {
          'rfc9110/example': {
            diagnostics: undefined,
            ruleFnResult: [
              {
                location: 'custom/loc',
                findings: [
                  { kind: 'rule-skip', title: 'skip', reason: 'no endpoint' },
                  { kind: 'informational', title: 'noted', message: 'fyi' },
                ],
              },
            ],
          },
        },
        [rule],
        format,
      );

      expect(executions).toHaveLength(1);
      expect(executions[0]?.status).toMatchObject({
        kind: 'skipped',
        reason: 'no endpoint',
      });
      // The co-occurring informational finding is not discarded.
      const findings = (executions[0] as { findings: { kind: string }[] })
        .findings;
      expect(findings.map((f) => f.kind)).toEqual(['informational']);
    });

    it('joins multiple rule-skip reasons on a single entry', () => {
      const executions = executionsFromRunRulesResult(
        {
          'rfc9110/example': {
            diagnostics: undefined,
            ruleFnResult: [
              {
                location: 'custom/loc',
                findings: [
                  { kind: 'rule-skip', title: 'skip 1', reason: 'reason A' },
                  { kind: 'rule-skip', title: 'skip 2', reason: 'reason B' },
                ],
              },
            ],
          },
        },
        [rule],
        format,
      );

      expect(executions[0]?.status).toMatchObject({
        kind: 'skipped',
        reason: 'reason A; reason B',
      });
    });

    it('marks the execution kind as analyze when requested (AC10)', () => {
      const executions = executionsFromRunRulesResult(
        {
          'rfc9110/example': {
            diagnostics: undefined,
            ruleFnResult: [{ location: 'custom/loc', findings: [] }],
          },
        },
        [rule],
        format,
        'analyze',
      );

      expect(executions[0]?.kind).toBe('analyze');
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

      expect(executions[0]?.status).toMatchObject({
        kind: 'failed',
        reason: 'Example summary',
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
