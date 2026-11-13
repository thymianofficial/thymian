import { expect, it } from 'vitest';

import {
  contexts,
  FALLBACK,
  INSECURE,
  onResponses,
  SECURE,
} from '../../test/set-cookie.js';
import rule from './user-agent-must-ignore-secure-cookie-over-insecure-connection.rule.js';

const SECURE_COOKIE = 'SID=31d4d96e407aad42; Secure';
const PLAIN_COOKIE = 'lang=en-US';

// Judged on the scheme and the cookie together.
it.each(contexts)(
  'flags, in %s, a Secure cookie over plain http',
  async (context) => {
    const {
      executions,
      transactions: [
        secureOverHttp,
        secureOverHttps,
        plainOverHttp,
        onFallback,
      ],
    } = await onResponses(rule, context, [
      { origin: INSECURE, lines: [SECURE_COOKIE] },
      { origin: SECURE, lines: [SECURE_COOKIE] },
      { origin: INSECURE, lines: [PLAIN_COOKIE] },
      { origin: FALLBACK, lines: [SECURE_COOKIE] },
    ]);
    const failed = {
      status: 'failed',
      severity: 'error',
      message:
        'A user agent ignores the cookie "SID" entirely (§5.7 step 13): it has the Secure attribute and was received over a connection that is not https. Set Secure cookies over https only.',
    };

    expect(executions).toMatchObject([
      { location: { elementId: secureOverHttp }, ...failed },
      { location: { elementId: secureOverHttps }, status: 'passed' },
      { location: { elementId: plainOverHttp }, status: 'passed' },
      // On http://localhost:8080 the scheme may be Thymian's rather than the
      // API's, so `static` and `test`, whose requests carry the described
      // origin, skip it. Recorded traffic is real: it is judged like any
      // other plain-http origin, never skipped.
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
