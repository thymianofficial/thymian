import { setCookieValueFixtures } from '../../test/builders.js';
import rule from './user-agent-must-ignore-attribute-value-over-1024-octets.rule.js';

// A Path of 1025 octets is one past the limit; the conforming line's is
// exactly at it. A Path is any run of av-octets, so both conform to the
// grammar.
export default setCookieValueFixtures(rule, {
  violates: [`SID=31d4d96e407aad42; Path=/${'a'.repeat(1024)}; Secure`],
  conforms: [`SID=31d4d96e407aad42; Path=/${'a'.repeat(1023)}; Secure`],
});
