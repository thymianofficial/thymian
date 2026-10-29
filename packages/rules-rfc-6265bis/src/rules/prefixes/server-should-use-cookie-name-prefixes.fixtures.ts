import { setCookieValueFixtures } from '../../test/builders.js';
import rule from './server-should-use-cookie-name-prefixes.rule.js';

// A Secure, host-only cookie on Path=/ meets every requirement of __Host-
// and carries no prefix. A cookie that carries one, and a cookie without
// Secure, which meets neither prefix's requirements, are passed.
export default setCookieValueFixtures(rule, {
  violates: ['SID=31d4d96e407aad42; Secure; Path=/'],
  conforms: ['__Host-SID=31d4d96e407aad42; Secure; Path=/', 'lang=en-US'],
});
