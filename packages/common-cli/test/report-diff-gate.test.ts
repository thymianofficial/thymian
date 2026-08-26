import type { ReportDiffChange } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import {
  FAIL_ON_VALUES,
  reportDiffGateFails,
} from '../src/report-diff-gate.js';

const addedError: ReportDiffChange = {
  kind: 'run-result',
  change: 'added',
  runType: 'lint',
  severity: 'error',
};
const addedWarn: ReportDiffChange = {
  kind: 'run-result',
  change: 'added',
  runType: 'lint',
  severity: 'warn',
};
const resolved: ReportDiffChange = {
  kind: 'run-result',
  change: 'removed',
  runType: 'lint',
  severity: 'error',
};
const specChanged: ReportDiffChange = {
  kind: 'specification',
  change: 'changed',
  endpoint: 'GET /users',
  method: 'GET',
  path: '/users',
  changedAspects: ['queryParameters'],
};
const ruleRemoved: ReportDiffChange = {
  kind: 'rule',
  change: 'removed',
  scope: 'ruleset',
  id: 'oldset',
};

describe('reportDiffGateFails', () => {
  it('exposes the documented mode set with regression first (the default)', () => {
    expect(FAIL_ON_VALUES).toEqual([
      'regression',
      'error',
      'any-change',
      'none',
    ]);
  });

  it('regression: any added run result fails, regardless of severity', () => {
    expect(reportDiffGateFails([addedWarn], 'regression')).toBe(true);
    expect(reportDiffGateFails([addedError], 'regression')).toBe(true);
    expect(
      reportDiffGateFails([resolved, specChanged, ruleRemoved], 'regression'),
    ).toBe(false);
    expect(reportDiffGateFails([], 'regression')).toBe(false);
  });

  it('error: only added error-severity run results fail', () => {
    expect(reportDiffGateFails([addedWarn], 'error')).toBe(false);
    expect(reportDiffGateFails([addedError], 'error')).toBe(true);
    expect(reportDiffGateFails([resolved], 'error')).toBe(false);
  });

  it('any-change: any change at all fails', () => {
    expect(reportDiffGateFails([specChanged], 'any-change')).toBe(true);
    expect(reportDiffGateFails([resolved], 'any-change')).toBe(true);
    expect(reportDiffGateFails([], 'any-change')).toBe(false);
  });

  it('none: never fails', () => {
    expect(
      reportDiffGateFails([addedError, specChanged, ruleRemoved], 'none'),
    ).toBe(false);
  });
});
