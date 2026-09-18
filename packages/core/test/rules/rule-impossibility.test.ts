import { describe, expect, it } from 'vitest';

import { httpRule } from '../../src/rules/rule-builder.js';

describe('impossibility reason vocabulary', () => {
  it('still accepts a bare informational declaration with no reason', () => {
    // This overload closes in the gate-closing ticket; until then the
    // corpus sweep has not run and every existing informational rule must
    // keep compiling.
    const rule = httpRule('bare-informational')
      .severity('error')
      .type('informational')
      .done();

    expect(rule.meta.type).toEqual(['informational']);
    expect(rule.meta.impossibility).toBeUndefined();
  });

  it('refuses an unknown reason code', () => {
    const builder = httpRule('unknown-reason').severity('error');

    // An unrecognized second argument cannot be told apart, at runtime, from
    // an attempt to declare multiple raw rule types — so this falls through
    // to the same 'unknown-rule-types' backstop a hand-bypassed call would
    // hit. The refusal this test cares about is the one above, at compile
    // time; the throw below just confirms nothing silently succeeds either.
    expect(() => {
      // @ts-expect-error 'not-a-real-code' is not a member of either tier
      builder.type('informational', 'not-a-real-code', 'note');
    }).toThrow();
  });

  it('refuses a tier-2 code where a tier-1 code is expected', () => {
    const builder = httpRule('tier-2-in-tier-1').severity('error');

    expect(() => {
      // @ts-expect-error 'participant-not-reachable' is tier 2, not tier 1
      builder.type('informational', 'participant-not-reachable', 'note');
    }).toThrow();
  });

  it('refuses tool-limitation with no issue reference', () => {
    const builder = httpRule('tool-limitation-no-issue').severity('error');

    // @ts-expect-error tool-limitation requires an IssueReference argument before the note
    const result = builder.type('informational', 'tool-limitation', 'note');

    expect(result).toBeDefined();
  });

  it('refuses tool-limitation with a malformed issue reference', () => {
    const builder = httpRule('tool-limitation-bad-issue').severity('error');

    // prettier-ignore
    // @ts-expect-error 'soon' is not an IssueReference
    const result = builder.type('informational', 'tool-limitation', 'soon', 'note');

    expect(result).toBeDefined();
  });

  it('builds a reasoned informational rule and carries the reason and note on meta', () => {
    const rule = httpRule('reasoned-informational')
      .severity('error')
      .type(
        'informational',
        'nothing-to-check',
        'A definition no message can violate.',
      )
      .done();

    expect(rule.meta.type).toEqual(['informational']);
    expect(rule.meta.impossibility).toEqual({
      reason: 'nothing-to-check',
      note: 'A definition no message can violate.',
    });
  });

  it('builds a tool-limitation rule and carries the issue on meta', () => {
    const rule = httpRule('tool-limitation-informational')
      .severity('error')
      .type(
        'informational',
        'tool-limitation',
        'thymianofficial/thymian-workspace#123',
        'Cannot send this yet.',
      )
      .done();

    expect(rule.meta.type).toEqual(['informational']);
    expect(rule.meta.impossibility).toEqual({
      reason: 'tool-limitation',
      issue: 'thymianofficial/thymian-workspace#123',
      note: 'Cannot send this yet.',
    });
  });

  it('trims the note', () => {
    const rule = httpRule('trims-note')
      .severity('error')
      .type('informational', 'peer-not-observable', '  spaced  ')
      .done();

    expect(rule.meta.impossibility).toEqual({
      reason: 'peer-not-observable',
      note: 'spaced',
    });
  });

  it('leaves an executable .type() call unchanged in arity and behaviour', () => {
    const rule = httpRule('still-executable')
      .severity('error')
      .type('static', 'test')
      .rule(() => [])
      .done();

    expect(rule.meta.type).toEqual(['static', 'test']);
    expect(rule.meta.impossibility).toBeUndefined();
  });
});
