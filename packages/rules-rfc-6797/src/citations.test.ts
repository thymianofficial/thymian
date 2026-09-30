import { readFileSync } from 'node:fs';

import { loadRules } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import rfc6797 from './index.js';

// Package = provenance. The rule set names the one document this package
// transcribes and the one slug it is known by; every rule cites an anchor in
// that document and carries that slug as its id prefix, both derived from the
// rule set rather than repeated here as literals.
describe('provenance: the cited document and the slug', () => {
  it('names RFC 6797 at rfc-editor.org as the cited document', () => {
    expect(rfc6797.url).toBe('https://www.rfc-editor.org/rfc/rfc6797.html');
  });

  it('cites a section anchor in the document the rule set names, for every rule', async () => {
    const rules = await loadRules('@thymian/rules-rfc-6797');

    for (const rule of rules) {
      expect(
        rule.meta.url?.startsWith(`${rfc6797.url}#section-`),
        `"${rule.meta.name}" cites "${rule.meta.url}"`,
      ).toBe(true);
    }
  }, 30_000);

  it('uses one slug for the npm specifier and the rule set name', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf-8'),
    ) as { name: string };

    expect(rfc6797.name).toBe('rfc-6797');
    expect(manifest.name).toBe(`@thymian/rules-${rfc6797.name}`);
  });

  it('prefixes every rule id with the slug', async () => {
    const rules = await loadRules('@thymian/rules-rfc-6797');

    for (const rule of rules) {
      expect(
        rule.meta.name.startsWith(`${rfc6797.name}/`),
        rule.meta.name,
      ).toBe(true);
    }
  }, 30_000);
});
