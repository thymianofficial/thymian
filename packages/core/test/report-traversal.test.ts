import { describe, expect, it } from 'vitest';

import type { Execution, FindingRecord } from '../src/report/index.js';
import {
  collectFindings,
  walkExecutions,
  walkFindings,
} from '../src/report/index.js';

function finding(id: string): FindingRecord {
  return { id, kind: 'informational', title: id };
}

const executions: Execution[] = [
  {
    kind: 'lint',
    ruleId: 'rule-a',
    status: { kind: 'failed', reason: 'nope' },
    location: { type: 'custom', value: 'lint-loc' },
    findings: [finding('lint-1')],
  },
  {
    kind: 'test',
    ruleId: 'rule-b',
    status: { kind: 'passed' },
    name: 'a test case',
    steps: [
      {
        name: 'Step 1',
        location: { type: 'custom', value: 'step-loc' },
        findings: [finding('step-1'), finding('step-2')],
      },
    ],
  },
  {
    kind: 'analyze',
    ruleId: 'rule-c',
    status: { kind: 'passed' },
    location: { type: 'custom', value: 'analyze-loc' },
    findings: [finding('analyze-1')],
  },
];

describe('walkExecutions', () => {
  it('yields every execution as a flat list', () => {
    const visits = [...walkExecutions(executions)];
    expect(visits.map((v) => v.execution.ruleId)).toEqual([
      'rule-a',
      'rule-b',
      'rule-c',
    ]);
  });

  it('handles undefined and empty execution lists', () => {
    expect([...walkExecutions(undefined)]).toEqual([]);
    expect([...walkExecutions([])]).toEqual([]);
  });
});

describe('walkFindings / collectFindings', () => {
  it('yields lint/analyze execution findings and test step findings', () => {
    expect(collectFindings(executions).map((f) => f.id)).toEqual([
      'lint-1',
      'step-1',
      'step-2',
      'analyze-1',
    ]);
  });

  it('reports the owning step for test findings and none otherwise', () => {
    const visits = [...walkFindings(executions)];

    const stepVisit = visits.find((v) => v.finding.id === 'step-1');
    expect(stepVisit?.step?.name).toBe('Step 1');
    expect(stepVisit?.execution.kind).toBe('test');

    const lintVisit = visits.find((v) => v.finding.id === 'lint-1');
    expect(lintVisit?.step).toBeUndefined();
  });
});
