import type { RulesConfiguration, RuleSet } from '@thymian/core';

const recommended: RulesConfiguration = {
  'rfc9110/client-may-generate-range-requests-without-accept-ranges': 'off',
  'rfc9110/client-may-send-if-match-header': 'off',
  'rfc9110/client-may-send-if-unmodified-since-header': 'off',
  'rfc9110/client-may-send-upgrade-header': 'off',
  'rfc9110/origin-server-may-generate-server-header-field': 'off',
  'rfc9110/origin-server-may-send-allow-header': 'off',
  'rfc9110/server-may-send-upgrade-header-in-other-responses': 'off',
  'rfc9110/server-may-send-www-authenticate-in-other-responses': 'off',
  'rfc9110/user-agent-may-send-date-header-in-request': 'off',
  'rfc9110/origin-server-may-redirect-for-existing-resource-for-201-response':
    'off',
  'rfc9110/origin-server-may-respond-with-404-instead-of-403': 'off',
  'rfc9110/server-should-send-validator-fields': 'off',
  'rfc9110/origin-server-should-send-content-length-when-size-known': {
    type: ['analytics', 'test'],
  },
  'rfc9110/origin-server-with-clock-must-generate-date-for-2xx-3xx-4xx': {
    type: ['analytics', 'test'],
  },
  'rfc9110/origin-server-should-send-etag': 'hint',
  'rfc9110/origin-server-should-send-last-modified': 'hint',
};

const rfc9110: RuleSet = {
  name: 'rfc9110',
  url: 'https://www.rfc-editor.org/rfc/rfc9110.html',
  pattern: 'rules/**/*.rule.js',
  profiles: {
    recommended,
    strict: {},
    minimal: recommended,
  },
};

export default rfc9110;
