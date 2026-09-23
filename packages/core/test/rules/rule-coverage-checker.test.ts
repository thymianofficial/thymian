import { describe, expect, it } from 'vitest';

import type { Rule } from '../../src/rules/rule.js';
import { httpRule } from '../../src/rules/rule-builder.js';
import { defineCoverage } from '../../src/rules/rule-coverage.js';
import { checkCoverage } from '../../src/rules/rule-coverage-checker.js';

const source = {
  revision: 'RFC 9999 (January 2099)',
  countingRule: 'One unit per BCP 14 keyword addressed to a server.',
  hasKeywordBasis: true,
};
const units = { '1.1': 'A statement a server must do the thing.' };

function staticTestRule(name: string): Rule {
  return httpRule(name)
    .severity('warn')
    .type('static', 'test')
    .rule(() => [])
    .done();
}

describe('coverage checker', () => {
  it('produces no violations for a clean, fully-declared record', () => {
    const rule = staticTestRule('clean-rule');
    const record = defineCoverage({
      source,
      units,
      rules: {
        'clean-rule': {
          covers: ['1.1'],
          declared: { types: ['static', 'test'], severity: 'warn' },
          contexts: {
            analytics: {
              verdict: 'impossible',
              reason: 'not-representable',
              note: 'The artifact does not carry the shape the assertion needs.',
            },
          },
        },
      },
    });

    expect(checkCoverage({ record, rules: [rule] })).toEqual([]);
  });

  it('catches a loaded rule with no entry', () => {
    const rule = staticTestRule('undocumented-rule');
    const record = defineCoverage({ source, units, rules: {} });

    const violations = checkCoverage({ record, rules: [rule] });

    expect(violations).toEqual([
      expect.objectContaining({
        code: 'missing-entry',
        rule: 'undocumented-rule',
      }),
    ]);
  });

  it('catches an entry that names no loaded rule', () => {
    const record = defineCoverage({
      source,
      units,
      rules: {
        'renamed-away': {
          covers: ['1.1'],
          declared: { types: ['static'], severity: 'error' },
        },
      },
    });

    const violations = checkCoverage({ record, rules: [] });

    expect(violations).toEqual([
      expect.objectContaining({
        code: 'orphaned-entry',
        rule: 'renamed-away',
      }),
    ]);
  });

  it('catches an undeclared context with no cell at all', () => {
    const rule = staticTestRule('missing-cell');
    const record = defineCoverage({
      source,
      units,
      rules: {
        'missing-cell': {
          covers: ['1.1'],
          declared: { types: ['static', 'test'], severity: 'warn' },
          // analytics is undeclared and carries no cell.
        },
      },
    });

    const violations = checkCoverage({ record, rules: [rule] });

    expect(violations).toEqual([
      expect.objectContaining({
        code: 'undeclared-context-cell-invalid',
        rule: 'missing-cell',
        context: 'analytics',
      }),
    ]);
  });

  it('catches an undeclared context marked with the bare observable/heuristic literal', () => {
    const rule = staticTestRule('blank-cell');
    const record = defineCoverage({
      source,
      units,
      rules: {
        'blank-cell': {
          covers: ['1.1'],
          declared: { types: ['static', 'test'], severity: 'warn' },
          contexts: { analytics: 'heuristic' },
        },
      },
    });

    const violations = checkCoverage({ record, rules: [rule] });

    expect(violations).toEqual([
      expect.objectContaining({
        code: 'undeclared-context-cell-invalid',
        rule: 'blank-cell',
        context: 'analytics',
      }),
    ]);
  });

  it('catches an undeclared context whose cell has an empty note', () => {
    const rule = staticTestRule('empty-note');
    const record = defineCoverage({
      source,
      units,
      rules: {
        'empty-note': {
          covers: ['1.1'],
          declared: { types: ['static', 'test'], severity: 'warn' },
          contexts: {
            analytics: {
              verdict: 'impossible',
              reason: 'not-representable',
              note: '   ',
            },
          },
        },
      },
    });

    const violations = checkCoverage({ record, rules: [rule] });

    expect(violations).toEqual([
      expect.objectContaining({
        code: 'undeclared-context-cell-invalid',
        rule: 'empty-note',
        context: 'analytics',
      }),
    ]);
  });

  it('names both sides of a stamp mismatch on types', () => {
    const rule = staticTestRule('drifted-types');
    const record = defineCoverage({
      source,
      units,
      rules: {
        'drifted-types': {
          covers: ['1.1'],
          declared: { types: ['static'], severity: 'warn' }, // rule also declares 'test'
          contexts: {
            analytics: {
              verdict: 'impossible',
              reason: 'not-representable',
              note: 'n',
            },
            test: {
              verdict: 'impossible',
              reason: 'not-representable',
              note: 'n',
            },
          },
        },
      },
    });

    const violations = checkCoverage({ record, rules: [rule] });

    expect(violations).toEqual([
      expect.objectContaining({
        code: 'stamp-mismatch',
        rule: 'drifted-types',
        message: expect.stringContaining('static'),
      }),
    ]);
    expect(violations[0]!.message).toContain('test');
  });

  it('names both sides of a stamp mismatch on severity', () => {
    const rule = staticTestRule('drifted-severity'); // built at 'warn'
    const record = defineCoverage({
      source,
      units,
      rules: {
        'drifted-severity': {
          covers: ['1.1'],
          declared: { types: ['static', 'test'], severity: 'error' },
          contexts: {
            analytics: {
              verdict: 'impossible',
              reason: 'not-representable',
              note: 'n',
            },
          },
        },
      },
    });

    const violations = checkCoverage({ record, rules: [rule] });

    expect(violations).toEqual([
      expect.objectContaining({
        code: 'stamp-mismatch',
        rule: 'drifted-severity',
      }),
    ]);
    expect(violations[0]!.message).toContain('error');
    expect(violations[0]!.message).toContain('warn');
  });

  it('catches a covers id naming no declared unit', () => {
    const rule = staticTestRule('bad-covers');
    const record = defineCoverage({
      source,
      units,
      rules: {
        'bad-covers': {
          covers: ['1.1'],
          declared: { types: ['static', 'test'], severity: 'warn' },
        },
      },
    });
    // Simulate runtime drift the type system can't see (e.g. a hand-edited
    // JSON record, or a unit later removed from `units`): mutate past the
    // compile-time guarantee.
    (record.rules['bad-covers'].covers as string[]).push('9.9');

    const violations = checkCoverage({ record, rules: [rule] });

    expect(violations).toContainEqual(
      expect.objectContaining({
        code: 'unknown-unit',
        rule: 'bad-covers',
        unit: '9.9',
      }),
    );
  });

  it('catches cells on an informational entry', () => {
    const rule = httpRule('pure-definition')
      .severity('off')
      .type(
        'informational',
        'nothing-to-check',
        'A definition no message can violate.',
      )
      .done();
    const record = defineCoverage({
      source,
      units,
      rules: {
        'pure-definition': {
          covers: ['1.1'],
          declared: { types: ['informational'], severity: 'off' },
        },
      },
    });
    // Same runtime-drift simulation as above: the type system already
    // refuses this at author time (#151); the checker re-verifies it for
    // a record loaded at runtime, where that guarantee no longer holds.
    (record.rules['pure-definition'] as { contexts?: unknown }).contexts = {
      static: { verdict: 'impossible', reason: 'not-representable', note: 'n' },
    };

    const violations = checkCoverage({ record, rules: [rule] });

    expect(violations).toEqual([
      expect.objectContaining({
        code: 'informational-entry-has-cells',
        rule: 'pure-definition',
      }),
    ]);
  });

  it('catches a severity drift on an informational entry', () => {
    // Built at 'off', the same as its entry's stamp below — then the rule
    // is promoted to 'warn' independently, simulating a rule whose severity
    // changed after its informational entry was written. Unlike `declared.
    // types` (fixed to `['informational']` by #151's type, so it can never
    // itself drift), `declared.severity` is a free field with no
    // compile-time link to the rule's live severity.
    const rule = httpRule('reclassified')
      .severity('off')
      .type('informational', 'nothing-to-check', 'A definition.')
      .done();
    rule.meta.severity = 'warn';
    const record = defineCoverage({
      source,
      units,
      rules: {
        reclassified: {
          covers: ['1.1'],
          declared: { types: ['informational'], severity: 'off' },
        },
      },
    });

    const violations = checkCoverage({ record, rules: [rule] });

    expect(violations).toEqual([
      expect.objectContaining({ code: 'stamp-mismatch', rule: 'reclassified' }),
    ]);
  });

  it('catches a malformed tool-limitation issue reference', () => {
    const rule = staticTestRule('bad-issue');
    const record = defineCoverage({
      source,
      units,
      rules: {
        'bad-issue': {
          covers: ['1.1'],
          declared: { types: ['static', 'test'], severity: 'warn' },
          contexts: {
            analytics: {
              verdict: 'impossible',
              reason: 'tool-limitation',
              issue: 'thymianofficial/thymian-workspace#151',
              note: 'n',
            },
          },
        },
      },
    });
    // Simulate a hand-edited/loaded record where the type guarantee no
    // longer holds.
    (
      record.rules['bad-issue']!.contexts as { analytics: { issue: unknown } }
    ).analytics.issue = 'soon';

    const violations = checkCoverage({ record, rules: [rule] });

    expect(violations).toEqual([
      expect.objectContaining({
        code: 'malformed-tool-limitation-issue',
        rule: 'bad-issue',
        context: 'analytics',
      }),
    ]);
  });

  it('catches an error-severity rule with no citation in a package with no keyword basis', () => {
    const rule = httpRule('uncited')
      .severity('error')
      .type('static', 'test')
      .rule(() => [])
      .done();
    const record = defineCoverage({
      source: {
        revision: 'r1',
        countingRule: 'One unit per cross-referenced section.',
        hasKeywordBasis: false,
      },
      units,
      rules: {
        uncited: {
          covers: ['1.1'],
          declared: { types: ['static', 'test'], severity: 'error' },
          contexts: {
            analytics: {
              verdict: 'impossible',
              reason: 'not-representable',
              note: 'n',
            },
          },
        },
      },
    });

    const violations = checkCoverage({ record, rules: [rule] });

    expect(violations).toEqual([
      expect.objectContaining({
        code: 'uncited-error-severity-rule',
        rule: 'uncited',
      }),
    ]);
  });

  it('does not flag an error-severity rule that carries a citation', () => {
    const rule = httpRule('cited')
      .severity('error')
      .type('static', 'test')
      .url('https://example.com/spec#cited')
      .rule(() => [])
      .done();
    const record = defineCoverage({
      source: {
        revision: 'r1',
        countingRule: 'One unit per cross-referenced section.',
        hasKeywordBasis: false,
      },
      units,
      rules: {
        cited: {
          covers: ['1.1'],
          declared: { types: ['static', 'test'], severity: 'error' },
          contexts: {
            analytics: {
              verdict: 'impossible',
              reason: 'not-representable',
              note: 'n',
            },
          },
        },
      },
    });

    expect(checkCoverage({ record, rules: [rule] })).toEqual([]);
  });

  it('catches a promoted convention rule missing a tag, marked heuristic, and with no explanation', () => {
    const rule = httpRule('convention-rule')
      .severity('off')
      .type('static', 'test')
      .rule(() => [])
      .done();
    const record = defineCoverage({
      source,
      units,
      rules: {
        'convention-rule': {
          covers: ['1.1'],
          declared: { types: ['static', 'test'], severity: 'off' },
          contexts: {
            static: 'heuristic',
            analytics: {
              verdict: 'impossible',
              reason: 'not-representable',
              note: 'n',
            },
          },
        },
      },
    });

    const violations = checkCoverage({
      record,
      rules: [rule],
      profiles: { strict: { 'convention-rule': 'warn' } },
    });

    expect(violations).toEqual([
      expect.objectContaining({
        code: 'undocumented-promoted-rule',
        rule: 'convention-rule',
        message: expect.stringContaining('strict'),
      }),
    ]);
    expect(violations[0]!.message).toContain('concern tag');
    expect(violations[0]!.message).toContain('heuristic');
    expect(violations[0]!.message).toContain('explanation');
  });

  it('does not flag a rule already enforced at baseline, even under a profile', () => {
    const rule = staticTestRule('already-enforced'); // baseline severity 'warn', not 'off'
    const record = defineCoverage({
      source,
      units,
      rules: {
        'already-enforced': {
          covers: ['1.1'],
          declared: { types: ['static', 'test'], severity: 'warn' },
          contexts: {
            static: 'heuristic', // would fail the promoted check if it applied
            analytics: {
              verdict: 'impossible',
              reason: 'not-representable',
              note: 'n',
            },
          },
        },
      },
    });

    const violations = checkCoverage({
      record,
      rules: [rule],
      profiles: { strict: { 'already-enforced': 'error' } },
    });

    expect(violations).toEqual([]);
  });

  it('does not flag a convention rule no shipped profile promotes', () => {
    const rule = httpRule('unpromoted')
      .severity('off')
      .type('static', 'test')
      .rule(() => [])
      .done();
    const record = defineCoverage({
      source,
      units,
      rules: {
        unpromoted: {
          covers: ['1.1'],
          declared: { types: ['static', 'test'], severity: 'off' },
          contexts: {
            analytics: {
              verdict: 'impossible',
              reason: 'not-representable',
              note: 'n',
            },
          },
        },
      },
    });

    const violations = checkCoverage({
      record,
      rules: [rule],
      profiles: { strict: {} }, // no entry for 'unpromoted'
    });

    expect(violations).toEqual([]);
  });

  it('catches README drift between the committed and generated blocks', () => {
    const record = defineCoverage({ source, units, rules: {} });

    const violations = checkCoverage({
      record,
      rules: [],
      readme: {
        committed: '## Coverage\n9 of 10',
        generated: '## Coverage\n10 of 10',
      },
    });

    expect(violations).toEqual([
      expect.objectContaining({ code: 'readme-drift' }),
    ]);
  });

  it('does not flag matching committed and generated README blocks', () => {
    const record = defineCoverage({ source, units, rules: {} });

    const violations = checkCoverage({
      record,
      rules: [],
      readme: {
        committed: '## Coverage\n10 of 10',
        generated: '## Coverage\n10 of 10',
      },
    });

    expect(violations).toEqual([]);
  });

  it('ignores rules and entries outside the given scope', () => {
    const inScopeRule = staticTestRule('in-scope');
    const outOfScopeRule = staticTestRule('out-of-scope'); // no entry — would violate if checked
    const record = defineCoverage({
      source,
      units,
      rules: {
        'in-scope': {
          covers: ['1.1'],
          declared: { types: ['static', 'test'], severity: 'warn' },
          contexts: {
            analytics: {
              verdict: 'impossible',
              reason: 'not-representable',
              note: 'n',
            },
          },
        },
        'stale-out-of-scope-entry': {
          covers: ['1.1'],
          declared: { types: ['static'], severity: 'error' },
        }, // orphaned — would violate if checked
      },
    });

    const violations = checkCoverage({
      record,
      rules: [inScopeRule, outOfScopeRule],
      scope: ['in-scope'],
    });

    expect(violations).toEqual([]);
  });
});
