import { cookiesOverPlainHttpFixtures } from '../../test/builders.js';
import rule from './server-should-send-cookies-only-over-https.rule.js';

// The same wire fact as the §8.3 rule it is the twin of, so the same
// fixtures. It ships `off`; the harness runs it at `warn`.
export default cookiesOverPlainHttpFixtures(rule);
