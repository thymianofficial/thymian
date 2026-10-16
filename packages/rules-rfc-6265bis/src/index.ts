import {
  deriveMinimalProfile,
  type RulesConfiguration,
  type RuleSet,
} from '@thymian/core';

import coverage from './coverage.js';

// The opinionated layer. It turns both convention rules on: HttpOnly at
// `warn`, because a cookie a script must read is a deliberate exception, and
// cookies only over https at `error`, because a cookie set over plain http
// has no exception that protects it. The https-only convention asks of every
// server, exactly, what §8.3 asks only of a server that requires a higher
// level of security, which no exchange shows; it replaces the heuristic rule
// that reports the same wire fact, so one response is reported once. §8.3's
// second clause, Secure on every cookie set over a secure channel, binds
// every server and is exact, so it is promoted from its keyword's `warn`.
const recommended: RulesConfiguration = {
  'rfc-6265bis/server-should-set-http-only-on-every-cookie': 'warn',
  'rfc-6265bis/server-should-send-cookies-only-over-https': 'error',
  'rfc-6265bis/server-requiring-higher-security-should-use-cookies-only-over-secure-channel':
    'off',
  'rfc-6265bis/server-should-set-secure-on-every-cookie-over-secure-channel':
    'error',
};

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
