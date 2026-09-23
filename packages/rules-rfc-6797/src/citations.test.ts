import { allRuleTags, loadRules, ruleTagVocabulary } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import rfc6797 from './index.js';

// Package = provenance, tag = concern. The rule set names the one document
// this package transcribes, and every rule cites an anchor in it — derived
// from the rule set's own `url`, not a literal repeated here. Every rule also
// carries a concern tag: HSTS is transport security, and the whole surface of
// the mechanism carries it, informational rules included.
describe('citations and concern tags', () => {
  it('names RFC 6797 at rfc-editor.org as the cited document', () => {
    expect(rfc6797.url).toBe('https://www.rfc-editor.org/rfc/rfc6797.html');
  });

  it('cites an anchor in the document the rule set names, for every rule', async () => {
    const rules = await loadRules('@thymian/rules-rfc-6797');

    for (const rule of rules) {
      expect(
        rule.meta.url?.startsWith(`${rfc6797.url}#section-`),
        `"${rule.meta.name}" cites "${rule.meta.url}"`,
      ).toBe(true);
    }
  }, 30_000);

  it('tags every rule with a fully-qualified tag from the vocabulary', async () => {
    const rules = await loadRules('@thymian/rules-rfc-6797');
    const bareCategories = Object.keys(ruleTagVocabulary);

    for (const rule of rules) {
      const tags = rule.meta.tags ?? [];
      expect(tags.length, `"${rule.meta.name}" is untagged`).toBeGreaterThan(0);
      for (const tag of tags) {
        expect(allRuleTags, `"${tag}" on "${rule.meta.name}"`).toContain(tag);
        expect(bareCategories).not.toContain(tag);
      }
    }
  }, 30_000);

  it('prefixes every rule id with the package slug', async () => {
    const rules = await loadRules('@thymian/rules-rfc-6797');

    for (const rule of rules) {
      expect(
        rule.meta.name.startsWith(`${rfc6797.name}/`),
        rule.meta.name,
      ).toBe(true);
    }
    expect(rfc6797.name).toBe('rfc-6797');
  }, 30_000);
});
