import type { ReportDiff } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { renderReportDiffSummary } from '../src/render/report-diff-summary.js';

function diffWith(changes: ReportDiff['changes']): ReportDiff {
  return {
    diffId: 'diff-1',
    createdAt: '2026-08-26T12:00:00.000Z',
    baseReportId: 'base-report',
    headReportId: 'head-report',
    baseCreatedAt: '2026-08-01T00:00:00.000Z',
    headCreatedAt: '2026-08-20T00:00:00.000Z',
    changes,
  };
}

describe('renderReportDiffSummary', () => {
  it('renders counts, one line per change, and highlights the regression', () => {
    const output = renderReportDiffSummary(
      diffWith([
        {
          kind: 'specification',
          change: 'changed',
          endpoint: 'GET /users',
          method: 'GET',
          path: '/users',
          changedAspects: ['queryParameters', 'responses'],
        },
        {
          kind: 'rule',
          change: 'removed',
          scope: 'ruleset',
          id: 'oldset',
        },
        {
          kind: 'run-result',
          change: 'added',
          runType: 'lint',
          severity: 'error',
          ruleId: 'rfc9110/x',
          locationLabel: 'GET /users',
        },
        {
          kind: 'run-result',
          change: 'removed',
          runType: 'test',
          severity: 'warn',
          ruleId: 'rfc9110/y',
          testCase: 'creates a user',
        },
      ]),
      { failOn: 'regression' },
    );

    expect(output).toContain(
      'Report diff: base base-report (2026-08-01T00:00:00.000Z) → head head-report (2026-08-20T00:00:00.000Z)',
    );
    expect(output).toContain('Specification  0 added · 1 changed · 0 removed');
    expect(output).toContain('Rules          0 added · 1 removed');
    expect(output).toContain('Run results    1 new · 1 resolved');
    expect(output).toContain(
      '~ endpoint GET /users changed: queryParameters, responses',
    );
    expect(output).toContain('- ruleset oldset removed');
    expect(output).toContain('+ [error] lint rfc9110/x — GET /users (new)');
    expect(output).toContain(
      '- [warn] test rfc9110/y — "creates a user" (resolved)',
    );
    expect(output).toContain(
      '✖ 1 new run result(s) — regression, 1 resolved (fails --fail-on regression)',
    );
  });

  it('reports an improvements-only diff as an improvement', () => {
    const output = renderReportDiffSummary(
      diffWith([
        {
          kind: 'run-result',
          change: 'removed',
          runType: 'lint',
          severity: 'error',
          ruleId: 'rfc9110/x',
        },
      ]),
      { failOn: 'regression' },
    );

    expect(output).toContain(
      '✔ Improvement: 1 run result(s) resolved, none added.',
    );
    expect(output).not.toContain('✖');
  });

  it('marks an improvements-only diff as failing under --fail-on any-change', () => {
    const output = renderReportDiffSummary(
      diffWith([
        {
          kind: 'run-result',
          change: 'removed',
          runType: 'lint',
          severity: 'error',
          ruleId: 'rfc9110/x',
        },
      ]),
      { failOn: 'any-change' },
    );

    expect(output).toContain(
      '✖ Improvement: 1 run result(s) resolved, none added (fails --fail-on any-change).',
    );
    expect(output).not.toContain('✔');
  });

  it('reports an empty diff as no changes', () => {
    const output = renderReportDiffSummary(diffWith([]), {
      failOn: 'regression',
    });

    expect(output).toContain('No changes between base and head.');
  });

  it('does not mark a regression as failing under --fail-on none', () => {
    const output = renderReportDiffSummary(
      diffWith([
        {
          kind: 'run-result',
          change: 'added',
          runType: 'lint',
          severity: 'error',
        },
      ]),
      { failOn: 'none' },
    );

    expect(output).toContain('• 1 new run result(s) — regression');
    expect(output).not.toContain('fails --fail-on');
  });
});
