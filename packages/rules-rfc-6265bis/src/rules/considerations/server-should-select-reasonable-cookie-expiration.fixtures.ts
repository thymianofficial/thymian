import { setCookieValueFixtures } from '../../test/builders.js';
import rule from './server-should-select-reasonable-cookie-expiration.rule.js';

// Two weeks are 1209600 seconds. A session identifier asking for 30 days is
// flagged; one asking for exactly two weeks passes, and so does a cookie
// whose name says nothing of its purpose, whatever its lifetime.
export default setCookieValueFixtures(rule, {
  violates: ['__Host-SID=31d4d96e407aad42; Secure; Path=/; Max-Age=2592000'],
  conforms: [
    '__Host-SID=31d4d96e407aad42; Secure; Path=/; Max-Age=1209600',
    'lang=en-US; Max-Age=31536000',
  ],
});
