import { setCookieValueFixtures } from '../../test/builders.js';
import rule from './user-agent-must-cap-cookie-lifetime-at-400-days.rule.js';

// 400 days are 34560000 seconds. The conforming line asks for exactly that
// in Max-Age, which wins over its Expires: the Expires in 2200 has no
// effect, so nothing is capped.
export default setCookieValueFixtures(rule, {
  violates: ['lang=en-US; Path=/; Max-Age=34560001'],
  conforms: [
    'lang=en-US; Path=/; Max-Age=34560000; Expires=Wed, 01 Jan 2200 00:00:00 GMT',
  ],
});
