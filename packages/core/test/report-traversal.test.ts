import { describe, expect, it } from 'vitest';

import type { Execution, FindingRecord } from '../src/report/index.js';
import {
  collectFindings,
  walkExecutions,
  walkFindings,
} from '../src/report/index.js';

function finding(id: string, nested?: FindingRecord[]): FindingRecord {
  return {
    id,
    kind: 'informational',
    title: id,
    severity: 'info',
    ...(nested
      ? { nestedFindings: nested.map((f) => ({ type: 'composed-of', finding: f })) }
      : {}),
  };
}

const tree: Execution[] = [
  {
    location: { type: 'custom', value: 'root' },
    findings: [finding('root-1')],
    children: [
      {
        location: { type: 'custom', value: 'rule' },
        findings: [finding('rule-1')],
        children: [
          {
            location: { type: 'custom', value: 'case' },
            findings: [
              finding('case-1', [finding('assert-1'), finding('assert-2')]),
            ],
          },
        ],
      },
    ],
  },
];

describe('walkExecutions', () => {
  it('yields every execution pre-order with correct depth and ancestors', () => {
    const visits = [...walkExecutions(tree)];

    expect(visits.map((v) => [v.execution.location, v.depth])).toEqual([
      [{ type: 'custom', value: 'root' }, 0],
      [{ type: 'custom', value: 'rule' }, 1],
      [{ type: 'custom', value: 'case' }, 2],
    ]);
    expect(visits[2].ancestors.map((a) => a.location)).toEqual([
      { type: 'custom', value: 'root' },
      { type: 'custom', value: 'rule' },
    ]);
  });

  it('handles undefined and empty execution lists', () => {
    expect([...walkExecutions(undefined)]).toEqual([]);
    expect([...walkExecutions([])]).toEqual([]);
  });
});

describe('walkFindings / collectFindings', () => {
  it('collects direct findings across the tree without nested by default', () => {
    expect(collectFindings(tree).map((f) => f.id)).toEqual([
      'root-1',
      'rule-1',
      'case-1',
    ]);
  });

  it('descends into nestedFindings when includeNested is set', () => {
    expect(
      collectFindings(tree, { includeNested: true }).map((f) => f.id),
    ).toEqual(['root-1', 'rule-1', 'case-1', 'assert-1', 'assert-2']);
  });

  it('reports nestedDepth and parentFindingId for nested findings', () => {
    const nested = [...walkFindings(tree, { includeNested: true })].find(
      (v) => v.finding.id === 'assert-1',
    );

    expect(nested?.nestedDepth).toBe(1);
    expect(nested?.parentFindingId).toBe('case-1');
    expect(nested?.depth).toBe(2);
  });

  it('does not infinite-loop on a self-referential nestedFindings cycle', () => {
    const cyclic: FindingRecord = {
      id: 'cyclic',
      kind: 'informational',
      title: 'cyclic',
      severity: 'info',
    };
    cyclic.nestedFindings = [{ type: 'caused-by', finding: cyclic }];

    const executions: Execution[] = [
      { location: { type: 'custom', value: 'x' }, findings: [cyclic] },
    ];

    const ids = collectFindings(executions, { includeNested: true }).map(
      (f) => f.id,
    );

    expect(ids).toEqual(['cyclic']);
  });
});
