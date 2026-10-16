import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { fixtureContexts } from '../../test/harness.js';
import { loadTopicRules, reportedBy } from '../../test/topic-rules.js';
import grammarRule from '../syntax/server-must-send-set-cookie-conforming-to-grammar.rule.js';

// One defect, one violation. On a line the grammar rejects, the grammar rule
// reports what a user agent does with it, every step of §5.6 included, so
// the rules on the size and recognition steps stay silent there. A line a
// user agent ignores entirely sets no cookie, so no rule on an attribute of
// it speaks. The lifetime cap is a defect of its own, on a lifetime the user
// agent did read, so it is reported beside the grammar's.

const GRAMMAR = 'rfc-6265bis/server-must-send-set-cookie-conforming-to-grammar';
const COOKIE_SIZE =
  'rfc-6265bis/user-agent-must-ignore-cookie-over-4096-octets';
const ATTRIBUTE_SIZE =
  'rfc-6265bis/user-agent-must-ignore-attribute-value-over-1024-octets';
const LIFETIME = 'rfc-6265bis/user-agent-must-cap-cookie-lifetime-at-400-days';

const rules = [
  grammarRule,
  ...(await loadTopicRules(dirname(fileURLToPath(import.meta.url)))),
];

const LONG_PATH = `Path=/${'a'.repeat(1024)}`;
const PAST_THE_CAP = 'Expires=Wed, 01 Jan 2200 00:00:00 GMT';

const cases: [string, string, string[]][] = [
  [
    'a line over 4096 octets the grammar rejects',
    `SID=${'x'.repeat(4090)} y`,
    [GRAMMAR],
  ],
  [
    'a Domain over 1024 octets, which fails its own production',
    `SID=31d4; Domain=${'a'.repeat(1025)}`,
    [GRAMMAR],
  ],
  [
    'a Path over 1024 octets on a line the grammar rejects',
    `SID="31 d4"; ${LONG_PATH}`,
    [GRAMMAR],
  ],
  [
    'an unrecognized attribute on a line the grammar rejects',
    'SID="31 d4"; Priority=High',
    [GRAMMAR],
  ],
  // Ignored for its length first (§5.6 step 6), so it is never also an
  // unrecognized one.
  [
    'an unrecognized attribute whose value is over 1024 octets',
    `SID=31d4; Priority=${'a'.repeat(1025)}`,
    [ATTRIBUTE_SIZE],
  ],
  [
    'a line over 4096 octets that also carries a long and an unrecognized attribute',
    `SID=${'x'.repeat(4094)}; Priority=High; ${LONG_PATH}; ${PAST_THE_CAP}`,
    [COOKIE_SIZE],
  ],
  [
    'a lifetime past the cap on a line a user agent ignores',
    `SID=31\u0007d4; ${PAST_THE_CAP}`,
    [GRAMMAR],
  ],
  [
    'an Expires past the cap on a line the grammar rejects but a user agent keeps',
    `SID="31 d4"; ${PAST_THE_CAP}`,
    [GRAMMAR, LIFETIME].sort(),
  ],
  [
    'an Expires past the cap, with no Max-Age to win over it',
    `SID=31d4; ${PAST_THE_CAP}`,
    [LIFETIME],
  ],
];

describe.each(fixtureContexts)('in %s', (context) => {
  it.each(cases)('reports %s once', async (_name, line, expected) => {
    expect(await reportedBy(rules, context, [line])).toEqual(expected);
  });
});
