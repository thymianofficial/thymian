import {
  deriveMinimalProfile,
  type RulesConfiguration,
  type RuleSet,
} from '@thymian/core';

import coverage from './coverage.js';

// The opinionated layer: every convention rule on, at the severity its own
// explanation argues for. Two conventions ask of every server, exactly, what
// RFC 6797 asks only of a host that has chosen to be an HSTS Host, which no
// exchange shows; each replaces the RFC rule that reports the same wire fact,
// so one response is reported once. The presence convention replaces 7.1's
// MAY `hint`, the redirect convention replaces 7.2's heuristic rule.
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
    // Source fidelity: every rule at its shipped severity, which follows
    // RFC 6797's keywords; convention rules stay off.
    strict: {},
    minimal: deriveMinimalProfile(coverage),
  },
  coverage,
};

export default rfc6797;
