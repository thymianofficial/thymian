import { setCookieValueFixtures } from '../../test/builders.js';
import rule from './server-must-send-set-cookie-conforming-to-grammar.rule.js';

// Two lines on one response, each judged on its own. The conforming pair
// carries an Expires date, whose comma a reader that split Set-Cookie on
// commas would break; in the violating pair only the second line deviates,
// with an Expires that is no IMF-fixdate.
export default setCookieValueFixtures(rule, {
  violates: [
    'SID=31d4d96e407aad42; Path=/; Secure; HttpOnly',
    'lang=en-US; Expires=Wed, 09-Jun-2021 10:18:14 GMT',
  ],
  conforms: [
    'SID=31d4d96e407aad42; Path=/; Secure; HttpOnly',
    'lang=en-US; Expires=Wed, 09 Jun 2021 10:18:14 GMT',
  ],
});
