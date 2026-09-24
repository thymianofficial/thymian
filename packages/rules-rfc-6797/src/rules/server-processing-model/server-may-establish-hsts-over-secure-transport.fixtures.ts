import type { RuleFixtures } from '../../test/harness.js';
import rule from './server-may-establish-hsts-over-secure-transport.rule.js';
import presence from './server-should-send-sts-header-over-secure-transport.fixtures.js';

// The same wire fact as the presence convention's, reported at `hint`.
export default { ...presence, rule } satisfies RuleFixtures;
