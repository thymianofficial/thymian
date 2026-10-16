import { setCookieValueFixtures } from '../../test/builders.js';
import rule from './server-should-set-http-only-on-every-cookie.rule.js';

// A cookie without HttpOnly is flagged; one with it passes, and so does a
// line that clears a cookie, which a browser keeps no cookie from. It ships
// `off`; the harness runs it at `warn`.
export default setCookieValueFixtures(rule, {
  violates: ['SID=31d4d96e407aad42; Secure'],
  conforms: [
    'SID=31d4d96e407aad42; Secure; HttpOnly',
    'lang=; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ],
});
