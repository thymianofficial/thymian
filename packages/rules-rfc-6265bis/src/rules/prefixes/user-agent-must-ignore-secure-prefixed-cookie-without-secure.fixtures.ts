import { setCookieValueFixtures } from '../../test/builders.js';
import rule from './user-agent-must-ignore-secure-prefixed-cookie-without-secure.rule.js';

// The prefix is matched case-insensitively, so a lowercase __secure- is the
// prefix all the same.
export default setCookieValueFixtures(rule, {
  violates: ['__secure-SID=31d4d96e407aad42; Path=/'],
  conforms: ['__Secure-SID=31d4d96e407aad42; Path=/; Secure'],
});
