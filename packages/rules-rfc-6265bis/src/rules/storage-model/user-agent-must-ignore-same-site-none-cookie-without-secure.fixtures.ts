import { setCookieValueFixtures } from '../../test/builders.js';
import rule from './user-agent-must-ignore-same-site-none-cookie-without-secure.rule.js';

// SameSite=None needs Secure; any other SameSite does not.
export default setCookieValueFixtures(rule, {
  violates: ['SID=31d4d96e407aad42; SameSite=None'],
  conforms: [
    'SID=31d4d96e407aad42; SameSite=None; Secure',
    'lang=en-US; SameSite=Lax',
  ],
});
