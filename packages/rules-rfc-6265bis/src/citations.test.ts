import { readFileSync } from 'node:fs';

import { loadRules } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import rfc6265bis from './index.js';

// Package = provenance. The rule set names the one document this package
// transcribes and the name it is known by. An Internet-Draft has no RFC
// Editor name, so that name is the package's slug, `rfc-6265bis`, in the npm
// specifier, the rule set's name and every rule id's prefix alike. Every rule
// cites an anchor in that document and carries that name as its id prefix,
// both derived from the rule set rather than repeated here as literals.
describe('provenance: the cited document and the rule set name', () => {
  it("names draft-22's versioned datatracker page as the cited document", () => {
    expect(rfc6265bis.url).toBe(
      'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22',
    );
  });

  it('cites a section anchor in the document the rule set names, for every rule', async () => {
    const rules = await loadRules('@thymian/rules-rfc-6265bis');

    for (const rule of rules) {
      expect(
        rule.meta.url?.match(/^(.*)#section-\d+(\.\d+)*$/)?.[1] ===
          rfc6265bis.url,
        `"${rule.meta.name}" cites "${rule.meta.url}"`,
      ).toBe(true);
    }
  }, 30_000);

  it('is named rfc-6265bis under the npm specifier @thymian/rules-rfc-6265bis', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf-8'),
    ) as { name: string };

    expect(rfc6265bis.name).toBe('rfc-6265bis');
    expect(manifest.name).toBe(`@thymian/rules-${rfc6265bis.name}`);
  });

  it('prefixes every rule id with the rule set name', async () => {
    const rules = await loadRules('@thymian/rules-rfc-6265bis');

    for (const rule of rules) {
      expect(
        rule.meta.name.startsWith(`${rfc6265bis.name}/`),
        rule.meta.name,
      ).toBe(true);
    }
  }, 30_000);
});
