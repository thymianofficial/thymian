import { describe, expect, it } from 'vitest';

import {
  contexts,
  FALLBACK,
  INSECURE,
  onOneResponse,
  onResponses,
  SECURE,
} from '../../test/set-cookie.js';
import rule from './server-should-set-secure-on-every-cookie-over-secure-channel.rule.js';

const SECURE_COOKIE = 'SID=31d4d96e407aad42; Secure';
const PLAIN_COOKIE = 'SID=31d4d96e407aad42';

// The scheme and the cookie together: a cookie without Secure over https.
it.each(contexts)(
  'flags, in %s, a cookie without Secure over https',
  async (context) => {
    const {
      executions,
      transactions: [
        plainOverHttps,
        secureOverHttps,
        plainOverHttp,
        onFallback,
      ],
    } = await onResponses(rule, context, [
      { origin: SECURE, lines: [PLAIN_COOKIE] },
      { origin: SECURE, lines: [SECURE_COOKIE] },
      // A cookie without Secure over plain http is the https-only rules'.
      { origin: INSECURE, lines: [PLAIN_COOKIE] },
      { origin: FALLBACK, lines: [PLAIN_COOKIE] },
    ]);

    expect(executions).toMatchObject([
      {
        location: { elementId: plainOverHttps },
        status: 'failed',
        severity: 'warn',
        message: expect.stringContaining(
          'The cookie "SID" is set over https without the Secure attribute',
        ),
      },
      { location: { elementId: secureOverHttps }, status: 'passed' },
      { location: { elementId: plainOverHttp }, status: 'passed' },
      // On http://localhost:8080 the scheme may be Thymian's rather than the
      // API's, so `static` and `test`, whose requests carry the described
      // origin, skip it. Recorded traffic is real: it is plain http, judged
      // like any other.
      context === 'analytics'
        ? { location: { elementId: onFallback }, status: 'passed' }
        : {
            location: { elementId: onFallback },
            status: 'skipped',
            reason: expect.stringContaining('loopback host'),
          },
    ]);
  },
);

// A line that clears its cookie sets none, so the rule leaves it out. Whether
// it clears it is judged against the Date of its response, never the time of
// the run: an old recording, or a description's example date, must not let
// a cookie without Secure through.

const PAST = 'SID=31d4d96e407aad42; Expires=Wed, 21 Oct 2015 07:28:00 GMT';
const EPOCH = 'SID=; Expires=Thu, 01 Jan 1970 00:00:00 GMT';

describe('a cookie without Secure over https', () => {
  it.each(['analytics', 'static'] as const)(
    'is flagged, in %s, when its Expires lies in the past but its response has no Date',
    async (context) => {
      expect(await onOneResponse(rule, context, [PAST])).toMatchObject({
        status: 'failed',
      });
    },
  );

  it('is flagged when its Expires lies after the Date of its response', async () => {
    expect(
      await onOneResponse(rule, 'analytics', [PAST], {
        headers: { Date: 'Tue, 20 Oct 2015 07:28:00 GMT' },
      }),
    ).toMatchObject({ status: 'failed' });
  });

  it('is left out when its Expires is at or before the Date of its response', async () => {
    expect(
      await onOneResponse(rule, 'analytics', [PAST], {
        headers: { Date: 'Thu, 22 Oct 2015 07:28:00 GMT' },
      }),
    ).toMatchObject({ status: 'passed' });
  });

  it.each(['analytics', 'static'] as const)(
    'is left out, in %s, when its Expires is the epoch, with no Date',
    async (context) => {
      expect(await onOneResponse(rule, context, [EPOCH])).toMatchObject({
        status: 'passed',
      });
    },
  );
});
