import { setCookieValueFixtures } from '../../test/builders.js';
import rule from './server-should-encrypt-and-sign-cookie-contents.rule.js';

// The violating value is `{"user":"alice","role":"admin"}`, percent-encoded,
// as a cookie-value must carry JSON. An opaque identifier, Base64 with its
// padding, a signed `s:` token and a language tag all pass.
export default setCookieValueFixtures(rule, {
  violates: [
    'profile=%7B%22user%22%3A%22alice%22%2C%22role%22%3A%22admin%22%7D',
  ],
  conforms: [
    'SID=31d4d96e407aad42',
    'token=c2lnbmVkIGFuZCBlbmNyeXB0ZWQ=',
    'connect.sid=s:5YhnTzWKvQ.Xq0Bo2m6Y8N5Hrj1Yf3h',
    'lang=en-US',
  ],
});
