import { setCookieValueFixtures } from '../../test/builders.js';
import rule from './server-may-wrap-cookie-value-in-double-quotes.rule.js';

export default setCookieValueFixtures(rule, {
  violates: ['SID=31d4d96e407aad42; Path=/; Secure'],
  conforms: ['SID="31d4d96e407aad42"; Path=/; Secure'],
});
