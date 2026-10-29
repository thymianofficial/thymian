import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Rule } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { setCookieInputs } from '../../test/builders.js';
import { fixtureContexts, runInContext } from '../../test/harness.js';

// One defect, one violation. The grammar rule owns parse failures: a line a
// user agent ignores, entirely or on receipt, sets no cookie, and the
// grammar rule alone reports it, with what the browser does. Every other
// rule in the syntax topic is silent on it, in every context. A line the
// grammar rejects but a user agent keeps still sets a cookie, so a defect of
// another kind on it is reported by its own rule.

const GRAMMAR_RULE =
  'rfc-6265bis/server-must-send-set-cookie-conforming-to-grammar';
const REPEAT_RULE = 'rfc-6265bis/server-must-not-repeat-cookie-attributes';

const syntaxDir = dirname(fileURLToPath(import.meta.url));

const rules: Rule[] = (
  await Promise.all(
    readdirSync(syntaxDir)
      .filter((file) => file.endsWith('.rule.ts'))
      .sort()
      .map(
        async (file) =>
          (
            (await import(pathToFileURL(join(syntaxDir, file)).href)) as {
              default: Rule;
            }
          ).default,
      ),
  )
).filter((rule) => !rule.meta.type.includes('informational'));

async function reportedBy(
  context: (typeof fixtureContexts)[number],
  lines: string[],
): Promise<string[]> {
  const names: string[] = [];
  for (const rule of rules.filter((r) => r.meta.type.includes(context))) {
    const results = await runInContext(
      context,
      rule,
      setCookieInputs(...lines)[context],
    );
    if (results.some((result) => result.violation !== undefined)) {
      names.push(rule.meta.name);
    }
  }
  return names.sort();
}

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
      expect(await reportedBy(context, lines)).toEqual([GRAMMAR_RULE]);
    },
  );

  // Combining that puts the comma in the cookie-value fails cookie-octet,
  // so it is the grammar rule's, and the combining rule leaves it there.
  it('reports a comma in the cookie-value once, from the grammar rule', async () => {
    expect(await reportedBy(context, ['SID=31d4, lang=en-US'])).toEqual([
      GRAMMAR_RULE,
    ]);
  });

  it('reports a repeated attribute on a line the grammar rejects but a user agent keeps', async () => {
    expect(await reportedBy(context, ['SID="31 d4"; Path=/; path=/a'])).toEqual(
      [GRAMMAR_RULE, REPEAT_RULE].sort(),
    );
  });
});
