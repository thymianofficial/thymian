import { defineFixtures } from '../../test/harness.js';
import redirectFixtures from './hsts-host-should-redirect-insecure-requests-to-https.fixtures.js';
import rule from './server-should-redirect-insecure-requests-to-https.rule.js';

// The same assertion as the RFC rule's, without its condition, so the same
// inputs demonstrate it.
export default defineFixtures({ ...redirectFixtures, rule });
