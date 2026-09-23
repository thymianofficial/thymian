import { defineFixtures } from '../../test/harness.js';
import rule from './server-may-establish-hsts-over-secure-transport.rule.js';
import presenceFixtures from './server-should-send-sts-header-over-secure-transport.fixtures.js';

// The same wire fact as the presence convention's, at `hint`.
export default defineFixtures({ ...presenceFixtures, rule });
