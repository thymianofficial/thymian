import { describe, expect, it } from 'vitest';

import type { FindingRecord, RuleDescriptor } from '../src/report/index.js';
import {
  buildRuleIndex,
  findingDetails,
  findingRuleId,
} from '../src/report/index.js';

function detailMap(finding: FindingRecord, rules?: RuleDescriptor[]) {
  const map: Record<string, string> = {};
  for (const { label, value } of findingDetails(
    finding,
    rules ? buildRuleIndex(rules) : undefined,
  )) {
    map[label] = value;
  }
  return map;
}

describe('findingRuleId', () => {
  it('returns the ruleId for rule findings and undefined otherwise', () => {
    expect(
      findingRuleId({
        id: '1',
        kind: 'rule-violation',
        ruleId: 'rfc/foo',
        title: 't',
        severity: 'error',
      }),
    ).toBe('rfc/foo');
    expect(
      findingRuleId({
        id: '2',
        kind: 'informational',
        title: 't',
        severity: 'info',
      }),
    ).toBeUndefined();
  });
});

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
  it('enriches rule findings with descriptor metadata', () => {
    const details = detailMap(
      {
        id: '1',
        kind: 'rule-violation',
        ruleId: 'rfc/foo',
        title: 't',
        severity: 'error',
      },
      [
        {
          id: 'rfc/foo',
          severity: 'error',
          name: 'Foo rule',
          summary: { text: 'must foo' },
          helpUri: 'https://example.com/foo',
        },
      ],
    );

    expect(details).toMatchObject({
      rule: 'rfc/foo',
      'rule name': 'Foo rule',
      summary: 'must foo',
      help: 'https://example.com/foo',
    });
  });

  it('renders skip reasons for rule-skip and test-case-skip', () => {
    expect(
      detailMap({
        id: '1',
        kind: 'rule-skip',
        ruleId: 'r',
        title: 't',
        severity: 'info',
        reason: 'not applicable',
      } as FindingRecord).reason,
    ).toBe('not applicable');
    expect(
      detailMap({
        id: '2',
        kind: 'test-case-skip',
        title: 't',
        severity: 'info',
        reason: 'env missing',
      } as FindingRecord).reason,
    ).toBe('env missing');
  });

  it('renders expected/actual for assertion failures', () => {
    const details = detailMap({
      id: '1',
      kind: 'assertion-failure',
      title: 't',
      severity: 'error',
      expected: 200,
      actual: 500,
    } as FindingRecord);
    expect(details.expected).toBe('200');
    expect(details.actual).toBe('500');
  });

  it('renders duration for test-case-pass and test-case-fail', () => {
    expect(
      detailMap({
        id: '1',
        kind: 'test-case-pass',
        title: 't',
        severity: 'info',
        durationMilliseconds: 42,
      } as FindingRecord).duration,
    ).toBe('42ms');
  });

  it('returns no extra details for kinds without specific fields', () => {
    expect(
      findingDetails({
        id: '1',
        kind: 'assertion-success',
        title: 't',
        severity: 'info',
      }),
    ).toEqual([]);
    expect(
      findingDetails({
        id: '2',
        kind: 'informational',
        title: 't',
        severity: 'info',
      }),
    ).toEqual([]);
  });
});
