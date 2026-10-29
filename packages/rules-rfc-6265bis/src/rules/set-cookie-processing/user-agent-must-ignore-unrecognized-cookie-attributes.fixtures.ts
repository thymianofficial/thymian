import { setCookieValueFixtures } from '../../test/builders.js';
import rule from './user-agent-must-ignore-unrecognized-cookie-attributes.rule.js';

// Priority is an extension-av no draft-22 user agent recognizes. The
// conforming line spells defined attributes in other cases, which a user
// agent still recognizes.
export default setCookieValueFixtures(rule, {
  violates: ['SID=31d4d96e407aad42; Path=/; Secure; Priority=High'],
  conforms: ['SID=31d4d96e407aad42; path=/; secure; HTTPONLY; SameSite=Lax'],
});
