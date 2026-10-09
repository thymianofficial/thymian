import { allRuleTags, loadRules } from '@thymian/core';
import { describe, expect, it } from 'vitest';

// Tag = concern. HSTS is transport security, and the whole surface of the
// mechanism carries a concern tag, informational rules included — so no rule
// in this package is untagged. That is stricter than the repo-wide rule,
// which lets a rule stay untagged under the `require-rule-tags` suppression
// comment: here a suppressed rule still fails. `allRuleTags` holds only
// fully-qualified terminal tags, so membership also refuses a bare category.
describe('concern tags', () => {
  it('tags every rule with a fully-qualified tag from the vocabulary', async () => {
    const rules = await loadRules('@thymian/rules-rfc-6797');

    for (const rule of rules) {
      const tags = rule.meta.tags ?? [];
      expect(tags.length, `"${rule.meta.name}" is untagged`).toBeGreaterThan(0);
      for (const tag of tags) {
        expect(allRuleTags, `"${tag}" on "${rule.meta.name}"`).toContain(tag);
      }
    }
  }, 30_000);

  it('tags every rule security:transport', async () => {
    const rules = await loadRules('@thymian/rules-rfc-6797');

    for (const rule of rules) {
      expect(rule.meta.tags, rule.meta.name).toContain('security:transport');
    }
  }, 30_000);
});
