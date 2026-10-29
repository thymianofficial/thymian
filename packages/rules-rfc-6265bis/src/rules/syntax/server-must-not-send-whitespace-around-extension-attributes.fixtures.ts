import { setCookieValueFixtures } from '../../test/builders.js';
import rule from './server-must-not-send-whitespace-around-extension-attributes.rule.js';

// The conforming line keeps the "; " every attribute is conventionally
// separated by, which the grammar reads as OWS before the attribute.
export default setCookieValueFixtures(rule, {
  violates: ['SID=31d4d96e407aad42; Priority=High ; Secure'],
  conforms: ['SID=31d4d96e407aad42; Priority=High; Secure'],
});
