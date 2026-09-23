import {
  deriveMinimalProfile,
  type RulesConfiguration,
  type RuleSet,
} from '@thymian/core';

import coverage from './coverage.js';

// The opinionated layer: every convention rule on, at the severity its own
// explanation argues for. Two of them ask of every server what RFC 6797 asks
// only under a condition Thymian cannot see, and replace the rule that checks
// the same wire fact under that condition, so a response is reported once.
// The two at `error` load under the default `ruleSeverity: 'error'` filter.
const recommended: RulesConfiguration = {
  'rfc-6797/server-should-send-sts-header-over-secure-transport': 'error',
  'rfc-6797/server-may-establish-hsts-over-secure-transport': 'off',
  'rfc-6797/server-should-redirect-insecure-requests-to-https': 'error',
  'rfc-6797/hsts-host-should-redirect-insecure-requests-to-https': 'off',
  'rfc-6797/server-should-send-sts-max-age-of-at-least-one-year': 'warn',
  'rfc-6797/server-should-send-sts-preload-directive': 'hint',
};

const rfc6797: RuleSet = {
  name: 'rfc-6797',
  url: 'https://www.rfc-editor.org/rfc/rfc6797.html',
  pattern: 'rules/**/*.rule.js',
  profiles: {
    recommended,
    // Source fidelity: every rule at its shipped severity, which already
    // follows RFC 6797's keywords; the convention rules stay off.
    strict: {},
    minimal: deriveMinimalProfile(coverage),
  },
  coverage,
};

export default rfc6797;
