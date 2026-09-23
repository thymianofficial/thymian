import { describe, expect, it } from 'vitest';

import type { Rule } from '../../src/rules/rule.js';
import { httpRule } from '../../src/rules/rule-builder.js';
import { defineCoverage } from '../../src/rules/rule-coverage.js';
import { renderCoverage } from '../../src/rules/rule-coverage-renderer.js';

const source = {
  revision: 'RFC 9999 (January 2099)',
  countingRule: 'One unit per BCP 14 keyword addressed to a server.',
  hasKeywordBasis: true,
};

function rule(
  name: string,
  opts: { severity?: 'error' | 'warn' | 'hint' | 'off' } = {},
): Rule {
  return httpRule(name)
    .severity(opts.severity ?? 'error')
    .type('static')
    .rule(() => [])
    .done();
}

describe('coverage renderer', () => {
  it('renders the five sections in order', () => {
    const record = defineCoverage({ source, units: {}, rules: {} });

    const output = renderCoverage({
      record,
      rulesByTopic: {},
      profiles: {},
    });

    const headings = [
      'Coverage',
      'Severity map',
      'Conventions',
      'Rule verdicts',
      'Tag status',
    ];
    let lastIndex = -1;
    for (const heading of headings) {
      const index = output.indexOf(`## ${heading}`);
      expect(index, `expected "${heading}" heading`).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it('carries both headline numbers, never a bare ratio, plus the counting rule, revision and substitute label', () => {
    const covering = rule('covers-it');
    const uncovered = rule('names-nothing');
    const record = defineCoverage({
      source: { ...source, substituteLabel: 'cross-referenced sections' },
      units: { '1.1': 'first', '1.2': 'second' },
      rules: {
        'covers-it': {
          covers: ['1.1'],
          declared: { types: ['static'], severity: 'error' },
        },
        'names-nothing': {
          covers: [],
          declared: { types: ['static'], severity: 'error' },
        },
      },
    });

    const output = renderCoverage({
      record,
      rulesByTopic: { main: [covering, uncovered] },
      profiles: {},
    });

    expect(output).toContain('**1 of 2**');
    expect(output).toContain('by **1**');
    expect(output).toContain(source.countingRule);
    expect(output).toContain(source.revision);
    expect(output).toContain('cross-referenced sections');
  });

  it('renders an honest headline for a source with no denominator, not an implied ratio', () => {
    const withoutDenominator = rule('shipped-anyway');
    const record = defineCoverage({ source, units: {}, rules: {} });

    const output = renderCoverage({
      record,
      rulesByTopic: { main: [withoutDenominator] },
      profiles: {},
    });

    expect(output).not.toMatch(/\d+ of \d+/);
    expect(output).toContain('No denominator declared');
    expect(output).toContain('1 rule(s)');
  });

  it('lists uncovered units without failing anything', () => {
    const record = defineCoverage({
      source,
      units: { '1.1': 'covered', '9.9': 'orphaned statement' },
      rules: {
        'the-rule': {
          covers: ['1.1'],
          declared: { types: ['static'], severity: 'error' },
        },
      },
    });

    const output = renderCoverage({
      record,
      rulesByTopic: { main: [rule('the-rule')] },
      profiles: {},
    });

    expect(output).toContain('Not yet covered');
    expect(output).toContain('`9.9`');
    expect(output).toContain('orphaned statement');
    expect(output).not.toContain('`1.1`');
  });

  it('takes per-profile counts from the loaded profile sets, not the record', () => {
    const record = defineCoverage({ source, units: {}, rules: {} });
    const recommendedRules = [
      rule('a', { severity: 'error' }),
      rule('b', { severity: 'warn' }),
    ];
    // A profile that loads almost nothing: only one rule survives, at 'hint'.
    const sparseRules = [rule('a', { severity: 'hint' })];

    const output = renderCoverage({
      record,
      rulesByTopic: { main: recommendedRules },
      profiles: { recommended: recommendedRules, sparse: sparseRules },
    });

    const severityMapSection = output.slice(
      output.indexOf('## Severity map'),
      output.indexOf('## Conventions'),
    );
    // recommended: 1 error, 1 warn, 0 hint; sparse: 0 error, 0 warn, 1 hint.
    expect(severityMapSection).toMatch(
      /\|\s*error\s*\|\s*MUST\s*\|\s*1\s*\|\s*0\s*\|/,
    );
    expect(severityMapSection).toMatch(
      /\|\s*hint\s*\|\s*MAY\s*\|\s*0\s*\|\s*1\s*\|/,
    );
  });

  it('generates conventions in full from off-severity executable rules, verbatim explanation, and "none" when empty', () => {
    const convention = httpRule('convention-rule')
      .severity('off')
      .type('static')
      .explanation('States the convention this promotes into a check.')
      .rule(() => [])
      .done();
    const record = defineCoverage({ source, units: {}, rules: {} });

    const withConvention = renderCoverage({
      record,
      rulesByTopic: { main: [convention] },
      profiles: {},
    });
    expect(withConvention).toContain(
      'States the convention this promotes into a check.',
    );

    const withoutAny = renderCoverage({
      record,
      rulesByTopic: { main: [rule('enforced-rule')] },
      profiles: {},
    });
    const conventionsSection = withoutAny.slice(
      withoutAny.indexOf('## Conventions'),
      withoutAny.indexOf('## Rule verdicts'),
    );
    expect(conventionsSection).toContain('None.');
  });

  it('renders rule-verdict tables once per topic directory, profile-independent', () => {
    const record = defineCoverage({
      source,
      units: { '1.1': 'text' },
      rules: {
        'a-rule': {
          covers: ['1.1'],
          declared: { types: ['static'], severity: 'error' },
        },
        'b-rule': {
          covers: ['1.1'],
          declared: { types: ['static'], severity: 'error' },
        },
      },
    });

    const output = renderCoverage({
      record,
      rulesByTopic: {
        'topic-one': [rule('a-rule')],
        'topic-two': [rule('b-rule')],
      },
      profiles: { strict: [rule('a-rule', { severity: 'error' })] }, // only affects severity map
    });

    expect(output).toContain('### topic-one');
    expect(output).toContain('### topic-two');
    // Rendered once — the topic-one heading does not repeat.
    expect(output.indexOf('### topic-one')).toBe(
      output.lastIndexOf('### topic-one'),
    );
  });

  it("derives an informational rule's row from its whole-rule reason, not from the record", () => {
    const informational = httpRule('pure-definition')
      .severity('off')
      .type(
        'informational',
        'nothing-to-check',
        'A definition no message can violate.',
      )
      .done();
    const record = defineCoverage({
      source,
      units: {},
      rules: {
        'pure-definition': {
          covers: [],
          declared: { types: ['informational'], severity: 'off' },
        },
      },
    });

    const output = renderCoverage({
      record,
      rulesByTopic: { main: [informational] },
      profiles: {},
    });

    expect(output).toContain('impossible (nothing-to-check)');
  });

  // A plain word: `~text~` is GitHub-flavoured strikethrough, and the
  // generator's Prettier pass rewrites it to `~~text~~`, so a marker built from
  // tildes renders a heuristic cell crossed out — read as "not heuristic".
  it('renders a heuristic cell as its own plain word, distinct from an exactly-observable one', () => {
    const record = defineCoverage({
      source,
      units: {},
      rules: {
        'heuristic-rule': {
          covers: [],
          declared: { types: ['static'], severity: 'error' },
          contexts: { static: 'heuristic' },
        },
      },
    });

    const output = renderCoverage({
      record,
      rulesByTopic: { main: [rule('heuristic-rule')] },
      profiles: {},
    });

    const verdictsSection = output.slice(output.indexOf('## Rule verdicts'));
    expect(verdictsSection).toMatch(/\|\s*heuristic\s*\|/);
    expect(verdictsSection).not.toMatch(/\|\s*observable\s*\|/);
  });

  it('names both the tags a package fills and the ones it ships empty, across the whole vocabulary', () => {
    const tagged = httpRule('tagged-rule')
      .severity('error')
      .type('static')
      .tags('security:transport')
      .rule(() => [])
      .done();
    const record = defineCoverage({ source, units: {}, rules: {} });

    const output = renderCoverage({
      record,
      rulesByTopic: { main: [tagged] },
      profiles: {},
    });

    const tagSection = output.slice(output.indexOf('## Tag status'));
    expect(tagSection).toContain('`security:transport` — 1 rule(s)');
    expect(tagSection).toContain('`security:cors` — ships empty');
    // A category this package's rules never touch at all (privacy) still
    // names every one of its tags as shipped empty — "the package ships
    // zero privacy rules" is said outright, not left for a reader to infer
    // from the category's absence.
    expect(tagSection).toContain('`privacy:tracking` — ships empty');
  });

  it('ships every tag in the closed vocabulary as empty for a package that contributes to none', () => {
    const record = defineCoverage({ source, units: {}, rules: {} });

    const output = renderCoverage({
      record,
      rulesByTopic: { main: [rule('untagged')] },
      profiles: {},
    });

    const tagSection = output.slice(output.indexOf('## Tag status'));
    expect(tagSection).toContain('`security:transport` — ships empty');
    expect(tagSection).toContain('`privacy:tracking` — ships empty');
    expect(tagSection).not.toMatch(/rule\(s\)/);
  });
});
