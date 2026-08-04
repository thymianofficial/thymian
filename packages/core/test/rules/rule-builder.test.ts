import { describe, expect, it } from 'vitest';

import { httpRule } from '../../src/rules/rule-builder.js';

describe('rule builder execution invariant', () => {
  it('builds a rule when .rule() covers all declared executable types', () => {
    const rule = httpRule('covered')
      .severity('error')
      .type('static', 'analytics', 'test')
      .rule(() => [])
      .done();

    expect(rule.lintRule).toBeTypeOf('function');
    expect(rule.analyzeRule).toBeTypeOf('function');
    expect(rule.testRule).toBeTypeOf('function');
  });

  it('builds a rule when overrides cover every declared type', () => {
    const rule = httpRule('covered-by-overrides')
      .severity('error')
      .type('static', 'analytics')
      .overrideStaticRule(() => [])
      .overrideAnalyticsRule(() => [])
      .done();

    expect(rule.lintRule).toBeTypeOf('function');
    expect(rule.analyzeRule).toBeTypeOf('function');
    expect(rule.testRule).toBeUndefined();
  });

  it('builds an informational rule without an execution function', () => {
    const rule = httpRule('informational')
      .severity('error')
      .type('informational')
      .description('documentation-only')
      .done();

    expect(rule.lintRule).toBeUndefined();
    expect(rule.analyzeRule).toBeUndefined();
    expect(rule.testRule).toBeUndefined();
  });

  it('throws on done() when an executable rule has no execution function', () => {
    const builder = httpRule('never-runs').severity('error').type('static');

    // @ts-expect-error done() is intentionally not callable without .rule()
    expect(() => builder.done()).toThrow(
      /no execution function for declared type\(s\): static/,
    );
  });

  it('throws on done() naming only the uncovered types', () => {
    const builder = httpRule('partially-covered')
      .severity('error')
      .type('static', 'analytics', 'test')
      .overrideStaticRule(() => []);

    // @ts-expect-error done() is intentionally not callable while types are uncovered
    expect(() => builder.done()).toThrow(
      /no execution function for declared type\(s\): analytics, test/,
    );
  });

  it('throws when informational is combined with executable types', () => {
    expect(() =>
      httpRule('mixed').severity('error').type('informational', 'static'),
    ).toThrow(/'informational' must be the only type/);
  });

  it('throws when a rule function is defined for an informational rule', () => {
    const builder = httpRule('informational-with-fn')
      .severity('error')
      .type('informational');

    // @ts-expect-error rule() intentionally rejects informational rules
    expect(() => builder.rule(() => [])).toThrow(/Cannot define rule function/);
  });
});
