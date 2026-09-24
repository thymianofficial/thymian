import { describe, expect, it } from 'vitest';

import type { CoverageRecord } from '../../src/rules/rule-coverage.js';
import { deriveMinimalProfile } from '../../src/rules/rule-coverage-minimal-profile.js';

// A small, synthetic record -- not a real package's corpus -- so each case
// below isolates exactly one qualification rule from ADR-0021 §3: error
// severity, and at least one declared context that is exactly observable
// (no cell, or a cell that isn't 'heuristic').
function record(rules: CoverageRecord['rules']): CoverageRecord {
  return {
    source: {
      revision: 'test fixture',
      countingRule: 'n/a',
      hasKeywordBasis: true,
    },
    units: {},
    rules,
  };
}

describe('deriveMinimalProfile', () => {
  it('omits an error-severity rule with an exactly-observable declared context', () => {
    const config = deriveMinimalProfile(
      record({
        'test/qualifies': {
          covers: [],
          declared: { types: ['static'], severity: 'error' },
        },
      }),
    );

    expect(config['test/qualifies']).toBeUndefined();
  });

  it('turns off a non-error-severity rule', () => {
    const config = deriveMinimalProfile(
      record({
        'test/warn-rule': {
          covers: [],
          declared: { types: ['static'], severity: 'warn' },
        },
        'test/hint-rule': {
          covers: [],
          declared: { types: ['analytics'], severity: 'hint' },
        },
      }),
    );

    expect(config['test/warn-rule']).toBe('off');
    expect(config['test/hint-rule']).toBe('off');
  });

  it('turns off an informational rule even at error severity', () => {
    const config = deriveMinimalProfile(
      record({
        'test/informational-error': {
          covers: [],
          declared: { types: ['informational'], severity: 'error' },
        },
      }),
    );

    expect(config['test/informational-error']).toBe('off');
  });

  it('turns off an error-severity rule whose only declared context is heuristic', () => {
    const config = deriveMinimalProfile(
      record({
        'test/all-heuristic': {
          covers: [],
          declared: { types: ['analytics'], severity: 'error' },
          contexts: { analytics: 'heuristic' },
        },
      }),
    );

    expect(config['test/all-heuristic']).toBe('off');
  });

  it('qualifies when at least one of several declared contexts is exactly observable', () => {
    const config = deriveMinimalProfile(
      record({
        'test/mixed': {
          covers: [],
          declared: { types: ['static', 'analytics'], severity: 'error' },
          // 'static' is marked heuristic; 'analytics' carries no cell, so it
          // stays exactly observable by default -- one is enough to qualify.
          contexts: { static: 'heuristic' },
        },
      }),
    );

    expect(config['test/mixed']).toBeUndefined();
  });

  it('produces a pure exception list: no explicit entry for a qualifying rule', () => {
    const config = deriveMinimalProfile(
      record({
        'test/qualifies': {
          covers: [],
          declared: { types: ['test'], severity: 'error' },
        },
        'test/does-not': {
          covers: [],
          declared: { types: ['informational'], severity: 'error' },
        },
      }),
    );

    expect(Object.keys(config)).toEqual(['test/does-not']);
  });
});
