import { describe, expect, it } from 'vitest';

import {
  type CoverageCell,
  defineCoverage,
} from '../../src/rules/rule-coverage.js';

describe('coverage record shape', () => {
  it('builds a minimal record with an executable entry and no cells', () => {
    const record = defineCoverage({
      source: {
        revision: 'RFC 9999 (January 2099)',
        countingRule: 'One unit per BCP 14 keyword addressed to a server.',
        hasKeywordBasis: true,
      },
      units: {
        '1.1': 'A statement a server must do the thing.',
      },
      rules: {
        'does-the-thing': {
          covers: ['1.1'],
          declared: { types: ['static'], severity: 'error' },
        },
      },
    });

    expect(record.units['1.1']).toBe('A statement a server must do the thing.');
    expect(record.rules['does-the-thing'].covers).toEqual(['1.1']);
  });

  it('omits contexts entirely on an executable entry', () => {
    const record = defineCoverage({
      source: {
        revision: 'r1',
        countingRule: 'one per statement',
        hasKeywordBasis: true,
      },
      units: { '1.1': 'text' },
      rules: {
        'no-contexts': {
          covers: ['1.1'],
          declared: { types: ['static', 'test'], severity: 'warn' },
        },
      },
    });

    expect(record.rules['no-contexts'].contexts).toBeUndefined();
  });

  it('marks an undeclared context impossible, with a note', () => {
    const record = defineCoverage({
      source: {
        revision: 'r1',
        countingRule: 'one per statement',
        hasKeywordBasis: true,
      },
      units: { '1.1': 'text' },
      rules: {
        'analytics-and-test-only': {
          covers: ['1.1'],
          declared: { types: ['analytics', 'test'], severity: 'error' },
          contexts: {
            static: {
              verdict: 'impossible',
              reason: 'not-representable',
              note: 'The artifact does not carry the shape the assertion needs.',
            },
          },
        },
      },
    });

    expect(record.rules['analytics-and-test-only'].contexts?.static).toEqual({
      verdict: 'impossible',
      reason: 'not-representable',
      note: 'The artifact does not carry the shape the assertion needs.',
    });
  });

  it('marks a declared context heuristic with the bare literal', () => {
    const record = defineCoverage({
      source: {
        revision: 'r1',
        countingRule: 'one per statement',
        hasKeywordBasis: true,
      },
      units: { '1.1': 'text' },
      rules: {
        'heuristic-in-analytics': {
          covers: ['1.1'],
          declared: { types: ['analytics'], severity: 'hint' },
          contexts: { analytics: 'heuristic' },
        },
      },
    });

    expect(record.rules['heuristic-in-analytics'].contexts?.analytics).toBe(
      'heuristic',
    );
  });

  it('carries an issue reference on a tool-limitation cell', () => {
    const record = defineCoverage({
      source: {
        revision: 'r1',
        countingRule: 'one per statement',
        hasKeywordBasis: true,
      },
      units: { '1.1': 'text' },
      rules: {
        'tool-limited': {
          covers: ['1.1'],
          declared: { types: ['test'], severity: 'error' },
          contexts: {
            static: {
              verdict: 'impossible',
              reason: 'tool-limitation',
              issue: 'thymianofficial/thymian-workspace#151',
              note: 'Cannot do this yet.',
            },
          },
        },
      },
    });

    expect(record.rules['tool-limited'].contexts?.static).toMatchObject({
      reason: 'tool-limitation',
      issue: 'thymianofficial/thymian-workspace#151',
    });
  });

  it('builds an informational entry with covers, a stamp, and no contexts', () => {
    const record = defineCoverage({
      source: {
        revision: 'r1',
        countingRule: 'one per statement',
        hasKeywordBasis: true,
      },
      units: { '1.1': 'text' },
      rules: {
        'pure-definition': {
          covers: ['1.1'],
          declared: { types: ['informational'], severity: 'off' },
        },
      },
    });

    expect(record.rules['pure-definition'].declared.types).toEqual([
      'informational',
    ]);
  });

  it("narrows reason === 'tool-limitation' to the branch carrying .issue", () => {
    function issueOf(cell: CoverageCell): string | undefined {
      if (typeof cell === 'string') {
        return undefined;
      }
      if (cell.reason !== 'tool-limitation') {
        // Narrowed away: no `.issue` on this branch.
        // @ts-expect-error 'issue' does not exist on the non-tool-limitation branch
        return cell.issue;
      }
      return cell.issue;
    }

    expect(
      issueOf({
        verdict: 'impossible',
        reason: 'tool-limitation',
        issue: 'thymianofficial/thymian-workspace#151',
        note: 'note',
      }),
    ).toBe('thymianofficial/thymian-workspace#151');

    expect(
      issueOf({
        verdict: 'impossible',
        reason: 'not-representable',
        note: 'note',
      }),
    ).toBeUndefined();
  });

  it('refuses an unknown unit id in covers', () => {
    defineCoverage({
      source: {
        revision: 'r1',
        countingRule: 'one per statement',
        hasKeywordBasis: true,
      },
      units: { '1.1': 'text' },
      rules: {
        'bad-unit': {
          // @ts-expect-error '9.9' is not a key of the declared units
          covers: ['9.9'],
          declared: { types: ['static'], severity: 'error' },
        },
      },
    });
  });

  it('refuses an unknown context reason code', () => {
    defineCoverage({
      source: {
        revision: 'r1',
        countingRule: 'one per statement',
        hasKeywordBasis: true,
      },
      units: { '1.1': 'text' },
      rules: {
        'bad-reason': {
          covers: ['1.1'],
          declared: { types: ['static', 'test'], severity: 'error' },
          contexts: {
            static: {
              verdict: 'impossible',
              // @ts-expect-error 'not-a-real-code' is not a member of ContextReason
              reason: 'not-a-real-code',
              note: 'n',
            },
          },
        },
      },
    });
  });

  it('refuses a tool-limitation cell with no issue reference', () => {
    defineCoverage({
      source: {
        revision: 'r1',
        countingRule: 'one per statement',
        hasKeywordBasis: true,
      },
      units: { '1.1': 'text' },
      rules: {
        'missing-issue': {
          covers: ['1.1'],
          declared: { types: ['static', 'test'], severity: 'error' },
          contexts: {
            // @ts-expect-error tool-limitation requires an 'issue' property
            analytics: {
              verdict: 'impossible',
              reason: 'tool-limitation',
              note: 'n',
            },
          },
        },
      },
    });
  });

  it('refuses a malformed issue reference on a tool-limitation cell', () => {
    defineCoverage({
      source: {
        revision: 'r1',
        countingRule: 'one per statement',
        hasKeywordBasis: true,
      },
      units: { '1.1': 'text' },
      rules: {
        'bad-issue': {
          covers: ['1.1'],
          declared: { types: ['static', 'test'], severity: 'error' },
          contexts: {
            analytics: {
              verdict: 'impossible',
              reason: 'tool-limitation',
              // @ts-expect-error 'soon' is not an IssueReference
              issue: 'soon',
              note: 'n',
            },
          },
        },
      },
    });
  });

  it('refuses a missing counting rule on the source', () => {
    defineCoverage({
      // @ts-expect-error countingRule is required
      source: { revision: 'r1', hasKeywordBasis: true },
      units: { '1.1': 'text' },
      rules: {},
    });
  });

  it('refuses a missing hasKeywordBasis on the source', () => {
    defineCoverage({
      // @ts-expect-error hasKeywordBasis is required
      source: { revision: 'r1', countingRule: 'one per statement' },
      units: { '1.1': 'text' },
      rules: {},
    });
  });

  it('refuses cells on an informational entry', () => {
    defineCoverage({
      source: {
        revision: 'r1',
        countingRule: 'one per statement',
        hasKeywordBasis: true,
      },
      units: { '1.1': 'text' },
      rules: {
        // @ts-expect-error an informational entry's cells all come from the whole-rule reason already; contexts is not allowed
        'informational-with-cells': {
          covers: ['1.1'],
          declared: { types: ['informational'], severity: 'off' },
          contexts: {
            static: {
              verdict: 'impossible',
              reason: 'not-representable',
              note: 'n',
            },
          },
        },
      },
    });
  });
});
