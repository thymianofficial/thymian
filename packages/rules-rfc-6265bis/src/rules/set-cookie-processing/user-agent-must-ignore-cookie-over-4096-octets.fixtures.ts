import { setCookieValueFixtures } from '../../test/builders.js';
import rule from './user-agent-must-ignore-cookie-over-4096-octets.rule.js';

// A name of 3 octets and a value of 4094 are 4097 together, one past the
// limit; the conforming line is exactly at it. Both lines conform to the
// grammar, which sets no length limit.
export default setCookieValueFixtures(rule, {
  violates: [`SID=${'x'.repeat(4094)}; Path=/; Secure`],
  conforms: [`SID=${'x'.repeat(4093)}; Path=/; Secure`],
});
