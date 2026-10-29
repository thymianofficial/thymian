import {
  deriveMinimalProfile,
  type RulesConfiguration,
  type RuleSet,
} from '@thymian/core';

import coverage from './coverage.js';

// The opinionated layer. Empty until the convention rules it turns on exist.
const recommended: RulesConfiguration = {};

// The source is an Internet-Draft, which has no RFC Editor name, so the
// rule-id prefix and the rule set's name are the package's slug (ADR-0021).
// The url pins the revision every rule cites: draft-22's own page, not the
// draft's unversioned one, which moves to the next revision or to the RFC.
const rfc6265bis: RuleSet = {
  name: 'rfc-6265bis',
  url: 'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22',
  pattern: 'rules/**/*.rule.js',
  profiles: {
    recommended,
    // Source fidelity: every rule at its shipped severity, which follows
    // draft-22's keywords; convention rules stay off.
    strict: {},
    minimal: deriveMinimalProfile(coverage),
  },
  coverage,
};

export default rfc6265bis;
