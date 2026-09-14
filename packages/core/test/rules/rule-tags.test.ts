import { describe, expect, it } from 'vitest';

import { httpRule } from '../../src/rules/rule-builder.js';
import type { RuleTag, RuleTagCategory } from '../../src/rules/rule-tags.js';
import { tagMatches } from '../../src/rules/rule-tags.js';

describe('rule tag vocabulary', () => {
  it('refuses a mistyped tag member', () => {
    const builder = httpRule('mistyped-tag').severity('error').type('static');

    // @ts-expect-error 'security:transprot' is not a member of the vocabulary
    expect(builder.tags('security:transprot')).toBeDefined();
  });

  it('refuses a third tag level', () => {
    const builder = httpRule('third-level-tag')
      .severity('error')
      .type('static');

    // @ts-expect-error a tag is at most one level deep
    expect(builder.tags('security:csp:script-src')).toBeDefined();
  });

  it('refuses a bare category on a rule', () => {
    const builder = httpRule('bare-category-tag')
      .severity('error')
      .type('static');

    // @ts-expect-error a rule's tag must be fully qualified and terminal
    expect(builder.tags('security')).toBeDefined();
  });
});

describe('tagMatches', () => {
  it('matches a tag against itself', () => {
    expect(tagMatches('security:cors', 'security:cors')).toBe(true);
  });

  it('matches a bare category against one of its members', () => {
    // The case .tags() refuses on a rule stays a legal pattern here.
    expect(tagMatches('security', 'security:cors')).toBe(true);
  });

  it('matches a category or member against a future third level', () => {
    const futureTag = 'security:csp:script-src' as RuleTag;

    expect(tagMatches('security:csp', futureTag)).toBe(true);
    expect(tagMatches('security', futureTag)).toBe(true);
  });

  it('does not match a non-segment prefix', () => {
    const notACategory = 'sec' as RuleTagCategory;

    expect(tagMatches(notACategory, 'security:cors')).toBe(false);
  });
});
