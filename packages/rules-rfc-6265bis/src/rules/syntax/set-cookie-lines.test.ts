import type { RuleFnResult } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { setCookieInputs } from '../../test/builders.js';
import { fixtureContexts, runInContext } from '../../test/harness.js';
import rule from './server-must-send-set-cookie-conforming-to-grammar.rule.js';

// Each Set-Cookie line is judged on its own, in every context: several lines
// on one response arrive as separate values, and nothing splits one on
// commas. A reader that joined the lines would quote them together; one that
// split them would break the Expires date at its comma.

const CONFORMING = 'lang=en-US; Expires=Wed, 09 Jun 2021 10:18:14 GMT';
const DEVIATING = 'SID=31d4; Max-Age=0';

const messages = (results: RuleFnResult[]) =>
  results.flatMap((result) =>
    result.violation === undefined ? [] : [result.violation.message ?? ''],
  );

describe.each(fixtureContexts)('in %s', (context) => {
  it('passes several conforming lines whose Expires carries a comma', async () => {
    const results = await runInContext(
      context,
      rule,
      setCookieInputs(CONFORMING, 'SID=31d4; Path=/; Secure')[context],
    );

    expect(messages(results)).toEqual([]);
  });

  it('quotes the deviating line alone, with the problem and what a browser does', async () => {
    const results = await runInContext(
      context,
      rule,
      setCookieInputs(CONFORMING, DEVIATING)[context],
    );

    expect(messages(results)).toEqual([
      `The Set-Cookie line "${DEVIATING}" deviates from the draft-22 §4.1.1 grammar: the Max-Age value "0" is not a positive number of seconds without a leading zero (non-zero-digit *DIGIT). A user agent parses Set-Cookie more leniently than the grammar and may still store this cookie, but no cookie consumer is bound to read it as the server meant.`,
    ]);
  });

  it.each([
    [
      'SID=31d4; Max-Age=1h',
      'A user agent ignores "Max-Age=1h", because the Max-Age value holds a character other than a digit (§5.6.2 step 3).',
    ],
    [
      'SID=31\u0007d4',
      'A user agent ignores the whole line, because the line holds the control character %x07 (§5.6 step 1).',
    ],
    [
      '=__Host-SID',
      'A user agent ignores the cookie, because its name is empty and its value starts with a cookie name prefix (§5.7 step 22).',
    ],
  ])('says what a browser does with "%s"', async (line, consequence) => {
    const results = await runInContext(
      context,
      rule,
      setCookieInputs(line)[context],
    );

    expect(messages(results)).toEqual([expect.stringContaining(consequence)]);
  });
});
