import { setCookieValueFixtures } from '../../test/builders.js';
import rule from './user-agent-must-replace-path-not-starting-with-slash.rule.js';

// A Path is any run of av-octets, so a relative or empty one conforms to the
// grammar; a user agent then scopes the cookie to the default-path instead.
// A Path past 1024 octets is ignored before it is read, which the
// 1024-octet rule reports, so this rule stays silent on it.
export default setCookieValueFixtures(rule, {
  violates: [
    'SID=31d4d96e407aad42; Path=docs; Secure',
    'SID=31d4d96e407aad42; Path=; Secure',
  ],
  conforms: [
    'SID=31d4d96e407aad42; Path=/docs; Secure',
    `SID=31d4d96e407aad42; Path=${'a'.repeat(1025)}; Secure`,
  ],
});
