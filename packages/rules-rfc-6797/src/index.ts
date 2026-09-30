import {
  deriveMinimalProfile,
  type RulesConfiguration,
  type RuleSet,
} from '@thymian/core';

import coverage from './coverage.js';

// The opinionated layer: every convention rule on, at the severity its own
// explanation argues for.
const recommended: RulesConfiguration = {
  'rfc-6797/server-should-send-sts-max-age-of-at-least-one-year': 'warn',
  'rfc-6797/server-should-send-sts-preload-directive': 'hint',
};

const rfc6797: RuleSet = {
  name: 'rfc-6797',
  url: 'https://www.rfc-editor.org/rfc/rfc6797.html',
  pattern: 'rules/**/*.rule.js',
  profiles: {
    recommended,
    // Source fidelity: every rule at its shipped severity, which follows
    // RFC 6797's keywords; convention rules stay off.
    strict: {},
    minimal: deriveMinimalProfile(coverage),
  },
  coverage,
};

export default rfc6797;
