import { setCookieValueFixtures } from '../../test/builders.js';
import rule from './origin-server-must-not-combine-set-cookie-fields.rule.js';

// The violating line is two cookies joined with ", " after the first one's
// last attribute, which the grammar accepts as part of its Path. The
// conforming lines are the same two cookies, each in a field of its own, the
// first with an Expires date, whose comma is no second cookie.
export default setCookieValueFixtures(rule, {
  violates: ['SID=31d4d96e407aad42; Path=/, lang=en-US; Path=/'],
  conforms: [
    'SID=31d4d96e407aad42; Path=/; Expires=Wed, 09 Jun 2021 10:18:14 GMT',
    'lang=en-US; Path=/',
  ],
});
