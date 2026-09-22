import { checkCoverage, loadRules } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import coverage from './coverage.js';
import rfc9110 from './index.js';

// A profile name that can't match any real one, so `resolveProfileConfig`'s
// documented fallback -- an unknown profile resolves to an empty override
// map -- gives every rule at its literal shipped `meta`, which is what
// `checkCoverage`'s stamp and citation-requirement assertions need. Same
// trick `scripts/generate-coverage.ts` uses.
const BASELINE_PROFILE_SENTINEL = '__coverage_test_baseline__';

async function loadBaselineRules() {
  return loadRules('@thymian/rules-rfc-9110', undefined, {}, undefined, {
    '@thymian/rules-rfc-9110': BASELINE_PROFILE_SENTINEL,
  });
}

// One block per landed sweep batch (#157-#162), each scoped to its own
// directories -- so a batch is verifiable on its own while the rest of the
// record is still empty, per the checker's own scope contract (#152).
// #163 folds these into one unscoped assertion once every batch has landed.
describe('coverage record', () => {
  describe('status-codes batch (#157)', () => {
    const scope = [
      'rfc9110/402-status-code-is-reserved',
      'rfc9110/client-may-combine-multiple-ranges-with-same-strong-validator-to-larger-range',
      'rfc9110/client-may-repeat-request-for-408-response',
      'rfc9110/client-may-repeat-request-with-new-credentials-for-403-response',
      'rfc9110/client-may-repeat-request-with-new-proxy-authenticate-header-for-407-response',
      'rfc9110/client-may-repeat-request-with-valid-content-length-header-for-411-response',
      'rfc9110/client-may-retry-after-given-time-for-413-response',
      'rfc9110/client-may-retry-request-over-different-connection',
      'rfc9110/client-must-be-able-to-parse-multiple-1xx-responses',
      'rfc9110/client-must-inspect-206-response-content-type-and-range',
      'rfc9110/client-must-inspect-content-range-header-in-multiple-parts-206-response',
      'rfc9110/client-must-not-generate-multiple-ranges-request-if-not-supported',
      'rfc9110/client-must-process-combined-response-correct',
      'rfc9110/client-must-understand-class-of-any-status-code',
      'rfc9110/client-must-use-other-header-fields-provided-in-new-for-206-response',
      'rfc9110/client-should-not-automatically-repeat-request-for-403-response',
      'rfc9110/client-should-process-invalid-status-code-as-5xx',
      'rfc9110/clients-should-detect-and-intervene-cyclical-redirections',
      'rfc9110/origin-server-may-respond-with-404-instead-of-403',
      'rfc9110/origin-server-must-generate-allow-header-for-405-response',
      'rfc9110/proxy-must-forward-1xx-responses',
      'rfc9110/proxy-must-not-send-421-response',
      'rfc9110/proxy-must-send-proxy-authenticate-header-for-407-response',
      'rfc9110/proxy-should-forward-304-response-to-outbound-client',
      'rfc9110/sender-should-not-generate-additional-representation-header-fields-for-206-response',
      'rfc9110/sender-should-not-generate-additional-representation-metadata-for-304-response',
      'rfc9110/server-may-close-connection-for-413-response',
      'rfc9110/server-may-coalesce-overlapping-or-small-gapped-ranges',
      'rfc9110/server-may-generate-multiple-parts-response-with-single-body',
      'rfc9110/server-may-send-retry-after-header-for-503-response',
      'rfc9110/server-may-terminate-request-for-413-response',
      'rfc9110/server-must-generate-content-range-header-for-single-part-206-response',
      'rfc9110/server-must-generate-content-range-header-in-corresponding-body-part-for-206-response',
      'rfc9110/server-must-generate-header-fields-for-206-response',
      'rfc9110/server-must-generate-header-fields-for-304-response',
      'rfc9110/server-must-generate-multipart-byteranges-content-for-multi-part-206-response',
      'rfc9110/server-must-generate-upgrade-header-field',
      'rfc9110/server-must-not-generate-content-for-205-response',
      'rfc9110/server-must-not-generate-content-range-header-for-multi-part-206-response',
      'rfc9110/server-must-not-generate-multipart-response-to-a-single-part-request',
      'rfc9110/server-must-not-send-1xx-response-to-1.0-client',
      'rfc9110/server-must-send-upgrade-header-for-426-response',
      'rfc9110/server-must-send-www-authenticate-header-for-401-response',
      'rfc9110/server-should-generate-content-for-300-response',
      'rfc9110/server-should-generate-content-for-406-response',
      'rfc9110/server-should-generate-content-for-409-response',
      'rfc9110/server-should-generate-content-range-header-for-416-response',
      'rfc9110/server-should-generate-content-type-header-in-body-for-206-response',
      'rfc9110/server-should-generate-location-header-field-for-301-response',
      'rfc9110/server-should-generate-location-header-for-302-response',
      'rfc9110/server-should-generate-location-header-for-307-response',
      'rfc9110/server-should-generate-location-header-for-308-response',
      'rfc9110/server-should-generate-location-header-for-preferred-choice-for-300-response',
      'rfc9110/server-should-generate-representation-for-505-response',
      'rfc9110/server-should-generate-retry-after-header-for-413-response',
      'rfc9110/server-should-send-error-representation-for-4xx-responses',
      'rfc9110/server-should-send-error-representation-for-5xx-response',
      'rfc9110/server-should-send-parts-in-order-of-range-header',
      'rfc9110/server-should-send-validator-fields',
      'rfc9110/status-code-305-is-deprecated',
      'rfc9110/status-code-306-is-reserved',
      'rfc9110/user-agent-may-change-request-method-from-post-to-get-for-301-response',
      'rfc9110/user-agent-may-change-request-method-from-post-to-get-for-302-response',
      'rfc9110/user-agent-may-redirect-to-location-header-uri-for-3xx-response',
      'rfc9110/user-agent-may-repeat-request-with-new-authorization-header',
      'rfc9110/user-agent-may-select-most-appropriate-choice-for-406-response',
      'rfc9110/user-agent-may-select-redirection-from-content',
      'rfc9110/user-agent-may-use-location-field-for-automatic-redirect',
      'rfc9110/user-agent-may-use-location-header-for-automatic-redirection',
      'rfc9110/user-agent-may-use-location-header-for-automatic-redirection-for-301-response',
      'rfc9110/user-agent-may-use-location-header-for-automatic-redirection-for-302-response',
      'rfc9110/user-agent-may-use-location-header-for-automatic-redirection-for-308-response',
      'rfc9110/user-agent-must-not-change-request-method-for-automatic-redirection-for-307-response',
      'rfc9110/user-agent-shoud-resend-original-request-with-modifications-for-redirected-requests',
      'rfc9110/user-agent-should-display-representation-to-the-user-for-5xx-response',
      'rfc9110/user-agent-should-present-error-representation-to-user',
      'rfc9110/user-agents-should-display-error-representation-to-user',
    ];

    it('has the expected rule count', () => {
      expect(scope.length).toBe(77);
    });

    it('reports zero violations', async () => {
      const rules = await loadBaselineRules();
      const violations = checkCoverage({
        record: coverage,
        rules,
        profiles: rfc9110.profiles,
        scope,
      });

      expect(violations).toEqual([]);
    });
  });
});
