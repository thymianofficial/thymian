import { loadRules } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import rfc9110 from './index.js';

// The citation guard (thymianofficial/thymian-workspace#165), on the corpus-load
// seam profiles.test.ts established and impossibility.test.ts reused.
//
// Package = provenance: the rule set names the one document this package is the
// provenance of, and `.url()` says where a rule within it is explained. So a
// rule's citation is an anchor in that document, and the rule set — not a
// literal repeated here — is what says which document that is.
//
// The corpus had drifted off that: 11 rules cited the same two sections of the
// same RFC at `datatracker.ietf.org` while 389 cited `rfc-editor.org`. Two hosts
// for one document is two documents to a reader following the link and to
// anything that groups rules by the document they cite.
const CITED_DOCUMENT = 'https://www.rfc-editor.org/rfc/rfc9110.html';

// The corpus's two deliberate exceptions: Content-Language rules left uncited
// when the rest of the package was cited. Their provenance is still to be
// settled — pending the coverage record's denominator
// (thymianofficial/thymian-workspace#156), which maps them by hand. Named
// explicitly so a third uncited rule cannot silently join them, and so a
// miscited rule cannot be "fixed" by dropping its `.url()` instead.
const PENDING_DENOMINATOR_EXCEPTIONS = [
  'rfc9110/content-language-may-be-applied-to-any-media-type',
  'rfc9110/multiple-languages-may-be-listed-for-multiple-audiences',
];

describe('the citation guard (thymianofficial/thymian-workspace#165)', () => {
  it('names the cited document on the rule set, where the rules derive it from', () => {
    expect(rfc9110.url).toBe(CITED_DOCUMENT);
  });

  it('cites an anchor in the document the rule set names, for every rule that carries a citation', async () => {
    const rules = await loadRules('@thymian/rules-rfc-9110');

    for (const rule of rules) {
      if (rule.meta.url === undefined) {
        continue;
      }

      expect(
        rule.meta.url.startsWith(`${rfc9110.url}#`),
        `"${rule.meta.name}" cites "${rule.meta.url}", not an anchor in "${rfc9110.url}"`,
      ).toBe(true);
    }
  }, 30_000);

  it('leaves exactly the two named, still-to-be-settled rules uncited', async () => {
    const rules = await loadRules('@thymian/rules-rfc-9110');
    const uncited = rules.filter((rule) => rule.meta.url === undefined);

    expect(uncited.map((rule) => rule.meta.name).sort()).toEqual(
      PENDING_DENOMINATOR_EXCEPTIONS,
    );
  }, 30_000);
});
