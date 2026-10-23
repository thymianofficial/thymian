import { setCookieValueFixtures } from '../../test/builders.js';
import rule from './server-must-not-repeat-cookie-attributes.rule.js';

// The violating line repeats Path in another case, which is the same
// attribute. The conforming pair carries the same attributes on two
// cookies: repetition counts within one line, not across a response.
export default setCookieValueFixtures(rule, {
  violates: ['SID=31d4d96e407aad42; Path=/; Secure; path=/account'],
  conforms: [
    'SID=31d4d96e407aad42; Path=/; Secure',
    'lang=en-US; Path=/; Secure',
  ],
});
