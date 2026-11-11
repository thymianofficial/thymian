import { cookiesOverPlainHttpFixtures } from '../../test/builders.js';
import rule from './server-requiring-higher-security-should-use-cookies-only-over-secure-channel.rule.js';

// The same wire fact as its convention twin, so the same fixtures.
export default cookiesOverPlainHttpFixtures(rule);
