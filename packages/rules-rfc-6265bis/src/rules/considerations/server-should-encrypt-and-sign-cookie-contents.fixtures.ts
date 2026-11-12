import { setCookieValueFixtures } from '../../test/builders.js';
import rule from './server-should-encrypt-and-sign-cookie-contents.rule.js';

// The violating value is `{"user":"alice","role":"admin"}`, percent-encoded,
// as a cookie-value must carry JSON. An opaque identifier, Base64 with its
// padding, a signed `s:` token, signed Base64 payloads joined to their
// signature by "--" or "." after the padding, and a language tag all pass.
export default setCookieValueFixtures(rule, {
  violates: [
    'profile=%7B%22user%22%3A%22alice%22%2C%22role%22%3A%22admin%22%7D',
  ],
  conforms: [
    'SID=31d4d96e407aad42',
    'token=c2lnbmVkIGFuZCBlbmNyeXB0ZWQ=',
    'connect.sid=s:5YhnTzWKvQ.Xq0Bo2m6Y8N5Hrj1Yf3h',
    '_app_session=eyJ1c2VyIjoiYWxpY2UifQ%3D--3f2a9c0d1e',
    '_rails_session=BAh7BkkiD3Nlc3Npb25faWQGOgZFVEkiJTk%3D--a1b2c3',
    'signed=Zm9v=.sig',
    'lang=en-US',
  ],
});
