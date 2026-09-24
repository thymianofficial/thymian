import type { RuleFixtures } from '../../test/harness.js';
import redirect from './hsts-host-should-redirect-insecure-requests-to-https.fixtures.js';
import rule from './server-should-redirect-insecure-requests-to-https.rule.js';

// The RFC rule's assertion without its condition, so the same inputs
// demonstrate it — the `test` status-code opt-out included.
export default { ...redirect, rule } satisfies RuleFixtures;
