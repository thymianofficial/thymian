import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { fixtureContexts } from '../../test/harness.js';
import { loadTopicRules, reportedBy } from '../../test/topic-rules.js';

// One defect, one violation. The grammar rule owns parse failures: a line a
// user agent ignores, entirely or on receipt, sets no cookie, and the
// grammar rule alone reports it, with what the browser does. Every other
// rule in the syntax topic is silent on it, in every context. A line the
// grammar rejects but a user agent keeps still sets a cookie, so a defect of
// another kind on it is reported by its own rule.

const GRAMMAR_RULE =
  'rfc-6265bis/server-must-send-set-cookie-conforming-to-grammar';
const REPEAT_RULE = 'rfc-6265bis/server-must-not-repeat-cookie-attributes';
const COMBINE_RULE =
  'rfc-6265bis/origin-server-must-not-combine-set-cookie-fields';

const rules = await loadTopicRules(dirname(fileURLToPath(import.meta.url)));

// Each would bait another syntax rule if it were read: an unquoted value,
// whitespace after an extension attribute, a repeated Path, a comma before
// a second cookie-pair, and a cookie-name set twice.
const ignored = [
  // §5.6 step 1: a control character.
  ['SID=31\u0007d4; Priority=High ; Path=/; path=/a, lang=en-US'],
  // §5.7 step 2: an empty name and value.
  ['=; Priority=High ; Path=/; path=/a'],
  // §5.7 step 22: an empty name with a prefixed value.
  ['=__Host-SID; Priority=High ; Path=/; path=/a'],
  // The first SID sets no cookie, so SID is set once, by a second line that
  // conforms to every rule.
  ['SID=31\u0007d4; Path=/', 'SID="31d4"; Path=/'],
];

describe.each(fixtureContexts)('in %s', (context) => {
  it.each(ignored)(
    'reports a line a user agent ignores once, from the grammar rule: %j',
    async (...lines) => {
      expect(await reportedBy(rules, context, lines)).toEqual([GRAMMAR_RULE]);
    },
  );

  // Combining that puts the comma in the cookie-value fails cookie-octet,
  // so it is the grammar rule's, and the combining rule leaves it there.
  it('reports a comma in the cookie-value once, from the grammar rule', async () => {
    expect(await reportedBy(rules, context, ['SID=31d4, lang=en-US'])).toEqual([
      GRAMMAR_RULE,
    ]);
  });

  it('reports a repeated attribute on a line the grammar rejects but a user agent keeps', async () => {
    expect(
      await reportedBy(rules, context, ['SID="31 d4"; Path=/; path=/a']),
    ).toEqual([GRAMMAR_RULE, REPEAT_RULE].sort());
  });

  // A comma in the value of an attribute with its own production breaks
  // that value, which the grammar rule reports; the cookie is still kept,
  // so the combining behind it is reported by its own rule.
  it.each([
    'SID=31d4; SameSite=Lax, lang=en-US; Path=/',
    'SID=31d4; Expires=Wed, 09 Jun 2021 10:18:14 GMT, lang=en-US; Path=/',
    'SID=31d4; Max-Age=3600, lang=en-US; Path=/',
    'SID=31d4; Domain=example.com, lang=en-US; Path=/',
  ])(
    'reports combining that breaks an attribute value from the grammar and the combining rule: %j',
    async (line) => {
      expect(await reportedBy(rules, context, [line])).toEqual(
        [GRAMMAR_RULE, COMBINE_RULE].sort(),
      );
    },
  );

  // Two combined cookies usually share an attribute; the repetition is the
  // combining, reported once.
  it('reports combined fields that repeat an attribute once, from the combining rule', async () => {
    expect(
      await reportedBy(rules, context, [
        'SID="31d4"; Path=/, lang=en-US; Path=/',
      ]),
    ).toEqual([COMBINE_RULE]);
  });

  // A cookie without a name is the grammar rule's (4.1.1/2), so two of
  // them are not one name set twice.
  it('reports two nameless cookies once each, from the grammar rule', async () => {
    expect(await reportedBy(rules, context, ['=31d4', '=en-US'])).toEqual([
      GRAMMAR_RULE,
    ]);
  });
});
