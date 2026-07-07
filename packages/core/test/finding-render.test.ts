import { describe, expect, it, vi } from 'vitest';

import type { Execution, FindingRecord } from '../src/report/index.js';
import {
  buildRuleIndex,
  findingDetails,
  resolveExecutionSeverity,
} from '../src/report/index.js';

function detailMap(finding: FindingRecord) {
  const map: Record<string, string> = {};
  for (const { label, value } of findingDetails(finding)) {
    map[label] = value;
  }
  return map;
}

describe('buildRuleIndex', () => {
  it('indexes descriptors by id', () => {
    const index = buildRuleIndex([
      { id: 'a', severity: 'error' },
      { id: 'b', severity: 'warn' },
    ]);
    expect(index.get('a')?.severity).toBe('error');
    expect(index.get('missing')).toBeUndefined();
  });
});

describe('findingDetails', () => {
  it('renders expected/actual for assertion failures', () => {
    const details = detailMap({
      id: '1',
      kind: 'assertion-failure',
      title: 't',
      expected: 200,
      actual: 500,
    } as FindingRecord);
    expect(details.expected).toBe('200');
    expect(details.actual).toBe('500');
  });

  it('returns no extra details for kinds without specific fields', () => {
    expect(
      findingDetails({ id: '1', kind: 'assertion-success', title: 't' }),
    ).toEqual([]);
    expect(
      findingDetails({ id: '2', kind: 'informational', title: 't' }),
    ).toEqual([]);
    expect(
      findingDetails({ id: '3', kind: 'rule-violation', title: 't' }),
    ).toEqual([]);
  });

  it('omits expected/actual individually when undefined, instead of stringifying "undefined" (regression, BaggersIO PR-311 finding 7)', () => {
    expect(
      findingDetails({
        id: '1',
        kind: 'assertion-failure',
        title: 't',
      } as FindingRecord),
    ).toEqual([]);

    expect(
      findingDetails({
        id: '2',
        kind: 'assertion-failure',
        title: 't',
        expected: 200,
      } as FindingRecord),
    ).toEqual([{ label: 'expected', value: '200' }]);

    expect(
      findingDetails({
        id: '3',
        kind: 'assertion-failure',
        title: 't',
        actual: 404,
      } as FindingRecord),
    ).toEqual([{ label: 'actual', value: '404' }]);
  });
});

describe('resolveExecutionSeverity', () => {
  const ruleIndex = buildRuleIndex([{ id: 'rfc/foo', severity: 'warn' }]);

  it('resolves a failed execution severity from its ruleId', () => {
    const execution: Execution = {
      kind: 'lint',
      ruleId: 'rfc/foo',
      status: { kind: 'failed', reason: 'boom' },
      location: { type: 'custom', value: 'x' },
      findings: [],
    };
    expect(resolveExecutionSeverity(execution, ruleIndex)).toBe('warn');
  });

  it('prefers the status severity override over the rule severity', () => {
    const execution: Execution = {
      kind: 'lint',
      ruleId: 'rfc/foo',
      status: { kind: 'failed', severity: 'error' },
      location: { type: 'custom', value: 'x' },
      findings: [],
    };
    expect(resolveExecutionSeverity(execution, ruleIndex)).toBe('error');
  });

  it('returns undefined for passed/skipped executions', () => {
    const passed: Execution = {
      kind: 'lint',
      ruleId: 'rfc/foo',
      status: { kind: 'passed' },
      location: { type: 'custom', value: 'x' },
      findings: [],
    };
    expect(resolveExecutionSeverity(passed, ruleIndex)).toBeUndefined();
  });

  it('falls back to error and warns when a failed severity is unresolvable (AC17)', () => {
    const logger = { warn: vi.fn() };
    const execution: Execution = {
      kind: 'lint',
      ruleId: 'not-in-rules',
      status: { kind: 'failed' },
      location: { type: 'custom', value: 'x' },
      findings: [],
    };
    expect(resolveExecutionSeverity(execution, ruleIndex, logger)).toBe(
      'error',
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('warns and ignores a severity on a non-failed status (AC16)', () => {
    const logger = { warn: vi.fn() };
    const execution = {
      kind: 'lint',
      ruleId: 'rfc/foo',
      status: { kind: 'passed', severity: 'error' },
      location: { type: 'custom', value: 'x' },
      findings: [],
    } as unknown as Execution;
    expect(
      resolveExecutionSeverity(execution, ruleIndex, logger),
    ).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
