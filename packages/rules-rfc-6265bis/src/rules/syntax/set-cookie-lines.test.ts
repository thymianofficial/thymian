import { describe, expect, it } from 'vitest';

import { contexts, onOneResponse } from '../../test/set-cookie.js';
import rule from './server-must-send-set-cookie-conforming-to-grammar.rule.js';

// Each Set-Cookie line is judged on its own, in every context: several lines
// on one response arrive as separate values, and nothing splits one on
// commas. A reader that joined the lines would quote them together; one that
// split them would break the Expires date at its comma.

const CONFORMING = 'lang=en-US; Expires=Wed, 09 Jun 2021 10:18:14 GMT';
const DEVIATING = 'SID=31d4; Max-Age=0';

describe.each(contexts)('in %s', (context) => {
  it('passes several conforming lines whose Expires carries a comma', async () => {
    expect(
      await onOneResponse(rule, context, [
        CONFORMING,
        'SID=31d4; Path=/; Secure',
      ]),
    ).toMatchObject({ status: 'passed' });
  });

  it('quotes the deviating line alone, with the problem and what a browser does', async () => {
    expect(
      await onOneResponse(rule, context, [CONFORMING, DEVIATING]),
    ).toMatchObject({
      status: 'failed',
      message: `The Set-Cookie line "${DEVIATING}" deviates from the draft-22 §4.1.1 grammar: the Max-Age value "0" is not a positive number of seconds without a leading zero (non-zero-digit *DIGIT). A user agent removes the cookie at once (§5.6.2 step 7); to delete a cookie within the grammar, send "Expires=Thu, 01 Jan 1970 00:00:00 GMT".`,
    });
  });

  it.each([
    [
      'SID=31d4; Max-Age=1h',
      'A user agent ignores "Max-Age=1h", because the Max-Age value holds a character other than a digit (§5.6.2 step 3).',
    ],
    [
      'SID=31d4; Max-Age=-1',
      'A user agent removes the cookie at once (§5.6.2 step 7)',
    ],
    [
      'SID=31d4; Max-Age=-0',
      'A user agent removes the cookie at once (§5.6.2 step 7)',
    ],
    // An empty cookie-av is no attribute a browser could ignore.
    [
      'SID=31d4;',
      'A user agent parses Set-Cookie more leniently than the grammar and may still store this cookie',
    ],
    [
      'SID=31d4;; Max-Age=1h',
      'A user agent ignores "Max-Age=1h", because the Max-Age value holds a character other than a digit (§5.6.2 step 3).',
    ],
    [
      'SID=31d4; Domain=.site.example',
      'A user agent ignores the leading "." of the Domain value (§5.6.3), so drop it.',
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
    expect(await onOneResponse(rule, context, [line])).toMatchObject({
      status: 'failed',
      message: expect.stringContaining(consequence),
    });
  });

  it('escapes a control character wherever the message quotes it', async () => {
    expect(
      await onOneResponse(rule, context, ['SID=31\u0007d4']),
    ).toMatchObject({
      status: 'failed',
      message: expect.stringContaining(
        'The Set-Cookie line "SID=31\\u0007d4" deviates',
      ),
    });
  });

  it.each([
    'SID\u0007',
    'S\u0001D=31d4',
    'SID="31d4\u0007',
    'SID=31d4; Max-Age=1\u0007',
    'SID=31d4; Expires=\u0007',
    'SID=31d4; Domain=\u0007',
    'SID=31d4; SameSite=\u0007',
    'SID=31d4; Foo=\u0000',
  ])(
    'writes no raw control character into the message for %j',
    async (line) => {
      const { status, message = '' } = await onOneResponse(rule, context, [
        line,
      ]);

      const isControl = (char: string) =>
        char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f;

      expect(status).toBe('failed');
      expect([...message].filter(isControl)).toEqual([]);
    },
  );
});
