import { setCookieValueFixtures } from '../../test/builders.js';
import rule from './user-agent-must-ignore-host-prefixed-cookie-unless-host-locked.rule.js';

// The prefix is matched case-insensitively, so __HOST- is the prefix all the
// same; its Domain keeps the cookie from being host-only.
export default setCookieValueFixtures(rule, {
  violates: ['__HOST-SID=31d4d96e407aad42; Secure; Path=/; Domain=example.com'],
  conforms: ['__Host-SID=31d4d96e407aad42; Secure; Path=/'],
});
