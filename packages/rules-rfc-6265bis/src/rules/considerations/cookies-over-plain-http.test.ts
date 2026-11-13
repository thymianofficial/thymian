import { describe, expect, it } from 'vitest';

import {
  contexts,
  FALLBACK,
  INSECURE,
  onResponses,
  SECURE,
} from '../../test/set-cookie.js';
import onlyOverSecureChannel from './server-requiring-higher-security-should-use-cookies-only-over-secure-channel.rule.js';
import onlyOverHttps from './server-should-send-cookies-only-over-https.rule.js';

// §8.3's conditional SHOULD and its convention twin, which asks the same of
// every server and ships `off`, report the same wire fact: a cookie a
// browser keeps from a response over plain http.
const plainHttpRules = [
  {
    rule: onlyOverSecureChannel,
    severity: 'warn',
    advice:
      'A server that requires a higher level of security should set cookies over https only.',
  },
  {
    rule: onlyOverHttps,
    severity: 'off',
    advice: 'Set cookies over https only.',
  },
] as const;

const PLAIN_COOKIE = 'SID=31d4d96e407aad42';
const SECURE_COOKIE = 'SID=31d4d96e407aad42; Secure';

describe.each(plainHttpRules)(
  '$rule.meta.name',
  ({ rule, severity, advice }) => {
    it.each(contexts)(
      'flags, in %s, a cookie without Secure over plain http',
      async (context) => {
        const {
          executions,
          transactions: [
            plainOverHttp,
            plainOverHttps,
            secureOverHttp,
            onFallback,
          ],
        } = await onResponses(rule, context, [
          { origin: INSECURE, lines: [PLAIN_COOKIE] },
          { origin: SECURE, lines: [PLAIN_COOKIE] },
          // A browser ignores a Secure cookie set over plain http, which
          // §5.7 step 13's rule reports.
          { origin: INSECURE, lines: [SECURE_COOKIE] },
          { origin: FALLBACK, lines: [PLAIN_COOKIE] },
        ]);
        const failed = {
          status: 'failed',
          severity,
          message: `The cookie "SID" is set over plain http: its name and value travel in clear text, a browser keeps it and sends it back over plain http, and anyone on the network can read or alter it on the way (§8.3). ${advice}`,
        };

        expect(executions).toMatchObject([
          { location: { elementId: plainOverHttp }, ...failed },
          { location: { elementId: plainOverHttps }, status: 'passed' },
          { location: { elementId: secureOverHttp }, status: 'passed' },
          // On http://localhost:8080 the scheme may be Thymian's rather than
          // the API's, so `static` and `test`, whose requests carry the
          // described origin, skip it. Recorded traffic is real: it is the
          // plain http it says it is.
          context === 'analytics'
            ? { location: { elementId: onFallback }, ...failed }
            : {
                location: { elementId: onFallback },
                status: 'skipped',
                reason: expect.stringContaining('loopback host'),
              },
        ]);
      },
    );
  },
);
