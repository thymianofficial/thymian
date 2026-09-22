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
    }, 30_000);
  });

  describe('routing batch (#158)', () => {
    const scope = [
      'rfc9110/client-may-send-upgrade-header',
      'rfc9110/client-must-not-use-special-request-target-forms-with-other-methods',
      'rfc9110/client-should-continue-sending-request-when-response-arrives',
      'rfc9110/firewall-intermediary-should-not-forward-internal-hosts',
      'rfc9110/firewall-intermediary-should-replace-internal-hosts-with-pseudonyms',
      'rfc9110/gateway-may-send-via-header-in-responses',
      'rfc9110/gateway-must-send-via-header-in-inbound-requests',
      'rfc9110/intermediary-may-combine-via-entries-with-identical-protocols',
      'rfc9110/intermediary-must-check-and-update-max-forwards',
      'rfc9110/intermediary-must-generate-updated-max-forwards-when-forwarding',
      'rfc9110/intermediary-must-implement-connection-header',
      'rfc9110/intermediary-must-not-forward-message-to-itself',
      'rfc9110/intermediary-must-not-forward-when-max-forwards-is-zero',
      'rfc9110/intermediary-must-parse-and-remove-connection-fields',
      'rfc9110/intermediary-must-respond-as-final-recipient-when-max-forward-is-zero',
      'rfc9110/intermediary-should-remove-known-hop-by-hop-fields',
      'rfc9110/origin-server-must-reject-https-requests-without-valid-certificate',
      'rfc9110/origin-server-must-reject-requests-not-meeting-scheme-requirements',
      'rfc9110/proxy-may-add-domain-to-non-fqdn-hostname',
      'rfc9110/proxy-may-transform-content-without-no-transform-directive',
      'rfc9110/proxy-must-not-change-fqdn-hostname',
      'rfc9110/proxy-must-not-modify-absolute-path-and-query',
      'rfc9110/proxy-must-not-transform-content-with-no-transform-directive',
      'rfc9110/proxy-must-send-via-header',
      'rfc9110/proxy-should-not-modify-endpoint-and-representation-headers',
      'rfc9110/recipient-may-ignore-max-forwards-for-other-methods',
      'rfc9110/recipient-may-interpret-missing-port-as-default',
      'rfc9110/recipient-may-remove-comments-before-forwarding',
      'rfc9110/recipient-should-use-case-insensitive-comparison-for-protocol-names',
      'rfc9110/sender-may-generate-comments-to-identify-software',
      'rfc9110/sender-may-replace-host-with-pseudonym',
      'rfc9110/sender-must-list-connection-specific-field-in-connection-header',
      'rfc9110/sender-must-not-combine-via-entries-with-different-protocols',
      'rfc9110/sender-must-not-send-end-to-end-fields-as-connection-options',
      'rfc9110/sender-must-send-upgrade-connection-option',
      'rfc9110/sender-should-not-combine-via-entries-unless-same-organization',
      'rfc9110/server-may-ignore-client-protocol-preference-order',
      'rfc9110/server-may-ignore-upgrade-header',
      'rfc9110/server-may-send-upgrade-header-in-other-responses',
      'rfc9110/server-must-ignore-upgrade-in-http-1.0-request',
      'rfc9110/server-must-list-protocols-in-layer-ascending-order',
      'rfc9110/server-must-not-switch-to-non-indicated-protocol',
      'rfc9110/server-must-not-switch-unless-semantics-can-be-honored',
      'rfc9110/server-must-send-100-before-101-with-expect-header',
      'rfc9110/server-must-send-upgrade-header-in-101-response',
      'rfc9110/server-must-send-upgrade-header-in-426-response',
      'rfc9110/user-agent-must-generate-host-or-authority-header',
      'rfc9110/user-agent-should-send-host-as-first-header',
    ];

    it('has the expected rule count', () => {
      expect(scope.length).toBe(48);
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
    }, 30_000);
  });

  describe('methods and range-requests batch (#159)', () => {
    const scope = [
      'rfc9110/accept-ranges-may-be-sent-in-trailer',
      'rfc9110/cache-may-use-responses-to-get-for-satisfy-subsequent-get-and-head-requests',
      'rfc9110/cache-may-use-responses-to-head-for-satisfy-subsequent-head-requests',
      'rfc9110/client-may-generate-range-requests-without-accept-ranges',
      'rfc9110/client-may-send-max-forwards-header-in-option-request',
      'rfc9110/client-must-ignore-content-length-or-transfer-encoding-headers-in-response-to-connect',
      'rfc9110/client-must-not-assume-future-range-support-from-accept-ranges',
      'rfc9110/client-must-not-generate-fields-containing-sensitive-data-in-trace-request',
      'rfc9110/client-must-not-send-content-in-trace-request',
      'rfc9110/client-must-send-content-type-header-for-content-in-options-request',
      'rfc9110/client-must-send-port-number-for-connect-request',
      'rfc9110/client-should-list-multiple-ranges-in-ascending-order',
      'rfc9110/client-should-not-automatically-retry-a-failed-automatic-retry',
      'rfc9110/client-should-not-automatically-retry-request-with-non-idempotent-method',
      'rfc9110/client-should-not-generate-content-for-delete-request',
      'rfc9110/client-should-not-generate-content-in-get-request',
      'rfc9110/client-should-not-generate-content-in-head-request',
      'rfc9110/client-should-not-request-inefficient-multiple-ranges',
      'rfc9110/final-recipient-of-trace-request-should-reflect-received-message',
      'rfc9110/final-recipient-should-exclude-sensitive-request-data-from-response-to-trace',
      'rfc9110/general-purpose-servers-must-support-get-and-head',
      'rfc9110/intermediary-must-attempt-to-send-outstanding-data-coming-from-closed-side-for-connect-request',
      'rfc9110/origin-server-may-accept-connect-request',
      'rfc9110/origin-server-may-redirect-for-existing-resource-for-201-response',
      'rfc9110/origin-server-must-disable-safe-methods-for-unsafe-resources',
      'rfc9110/origin-server-must-ignore-range-header-with-unknown-range-unit',
      'rfc9110/origin-server-must-not-sent-validator-field-in-response-to-put-request',
      'rfc9110/origin-server-must-respond-with-correct-response-code-for-put-request',
      'rfc9110/origin-server-must-send-3xx-response-if-state-change-should-be-applied-to-other-resource',
      'rfc9110/origin-server-should-ingore-unrecognized-header-and-trailer-fields-received-in-put-request',
      'rfc9110/origin-server-should-not-rely-on-private-agreements',
      'rfc9110/origin-server-should-not-rely-on-private-agreements-for-head-requests',
      'rfc9110/origin-server-should-not-rely-on-private-agreements-to-receive-content-in-delete-request',
      'rfc9110/origin-server-should-response-with-409-or-415-status-code-to-put-request-for-inconsistent-representation',
      'rfc9110/origin-server-should-send-400-for-unsupported-partial-put',
      'rfc9110/origin-server-should-send-405-response-for-unallowed-method',
      'rfc9110/origin-server-should-send-501-response-for-unrecognized-method',
      'rfc9110/origin-server-should-send-correct-successful-status-code-to-delete-request',
      'rfc9110/origin-server-should-send-location-header-for-201-response',
      'rfc9110/origin-server-should-verify-constraints-for-target-resource-for-put-request',
      'rfc9110/other-methods-than-get-and-head-are-optional',
      'rfc9110/proxy-may-discard-range-header-with-unknown-range-unit',
      'rfc9110/proxy-must-not-automatically-retry-non-idempontent-requests',
      'rfc9110/proxy-must-not-generate-new-max-forwards-header',
      'rfc9110/proxy-should-forward-206-with-unknown-range-unit',
      'rfc9110/recipient-must-anticipate-large-decimal-numerals-for-byte-range',
      'rfc9110/recipient-must-not-recombine-206-with-unknown-range-unit',
      'rfc9110/recipient-must-not-recombine-invalid-content-range',
      'rfc9110/sender-should-indicate-complete-length-for-byte-ranges',
      'rfc9110/server-may-ignore-or-reject-invalid-range-header',
      'rfc9110/server-may-ignore-range-header',
      'rfc9110/server-may-ignore-range-header-for-zero-length-representation',
      'rfc9110/server-may-omit-header-fields-for-head-response',
      'rfc9110/server-may-send-accept-ranges-none',
      'rfc9110/server-must-ignore-content-range-for-unsupported-method',
      'rfc9110/server-must-ignore-range-header-for-unrecognized-method',
      'rfc9110/server-must-not-send-content-in-response-to-head',
      'rfc9110/server-must-not-send-transfer-encoding-or-content-length-headers-in-2xx-response-to-connect-request',
      'rfc9110/server-must-reject-connect-request-with-empty-or-invalid-port-number',
      'rfc9110/server-should-send-206-response-for-satisfiable-range',
      'rfc9110/server-should-send-416-response-for-unsatisfiable-range',
      'rfc9110/server-should-send-content-range-in-416-response',
      'rfc9110/server-should-send-headers-indicating-optional-features-in-2xx-response-to-options-request',
      'rfc9110/server-should-send-same-header-fields-in-response-to-head',
      'rfc9110/service-that-selects-uri-for-client-should-use-post-instead-of-put',
      'rfc9110/user-agent-distinguish-between-safe-and-unsafe-methods',
      'rfc9110/user-agent-may-make-own-decision-to-redirect-request-for-3xx-response-to-put-request',
    ];

    it('has the expected rule count', () => {
      expect(scope.length).toBe(67);
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
    }, 30_000);
  });

  describe('conditional-requests and identifiers batch (#160)', () => {
    const scope = [
      'rfc9110/authority-should-not-use-equivalent-uris-for-distinct-resources',
      'rfc9110/automated-client-must-log-error-to-audit-log-for-bad-certificate',
      'rfc9110/automated-client-should-terminate-connection-for-bad-certificate',
      'rfc9110/automated-clients-may-provide-setting-to-disable-certificate-check',
      'rfc9110/automated-clients-must-provide-setting-to-enable-certificate-check',
      'rfc9110/cache-or-intermediary-may-ignore-if-match',
      'rfc9110/cache-or-intermediary-may-ignore-if-unmodified-since',
      'rfc9110/client-may-access-by-resolving-host-to-ip-address',
      'rfc9110/client-may-send-if-match-header',
      'rfc9110/client-may-send-if-unmodified-since-header',
      'rfc9110/client-must-construct-reference-identity',
      'rfc9110/client-must-not-generate-if-range-header-containing-http-date',
      'rfc9110/client-must-not-generate-if-range-with-weak-etag',
      'rfc9110/client-must-not-generate-if-range-without-range',
      'rfc9110/client-must-not-use-cn-id-reference-identity',
      'rfc9110/client-must-secure-https-requests-and-responses',
      'rfc9110/client-must-use-rfc6125-verification',
      'rfc9110/client-must-verify-service-identity',
      'rfc9110/client-should-generate-if-none-match-for-cache-updates',
      'rfc9110/http-component-may-perform-normalization',
      'rfc9110/non-origin-server-must-not-evaluate-conditional-headers',
      'rfc9110/origin-server-may-respond-with-2xx-response-even-condition-failed',
      'rfc9110/origin-server-may-respond-with-2xx-response-even-condition-failed-for-unmodified-since',
      'rfc9110/origin-server-may-respond-with-412-response-to-conditional-request',
      'rfc9110/origin-server-may-respond-with-412-response-to-unmodified-since',
      'rfc9110/origin-server-must-evaluate-if-match-before-method',
      'rfc9110/origin-server-must-evaluate-if-none-match-before-method',
      'rfc9110/origin-server-must-evaluate-if-unmodified-since',
      'rfc9110/origin-server-must-ignore-if-range-header-if-target-resource-does-not-support-range-requests',
      'rfc9110/origin-server-must-not-perform-method-when-if-match-fails',
      'rfc9110/origin-server-must-not-perform-method-when-if-unmodified-since-fails',
      'rfc9110/origin-server-must-respond-304-or-412-when-if-none-match-fails',
      'rfc9110/origin-server-must-use-strong-comparison-for-if-match',
      'rfc9110/origin-server-should-evaluate-if-modified-since',
      'rfc9110/origin-server-should-respond-304-when-if-modified-since-false',
      'rfc9110/recipient-must-ignore-if-modified-since-for-non-get-head',
      'rfc9110/recipient-must-ignore-if-modified-since-header-if-no-date-available',
      'rfc9110/recipient-must-ignore-if-modified-since-when-if-none-match-present',
      'rfc9110/recipient-must-ignore-if-unmodified-since-header-if-no-date-available',
      'rfc9110/recipient-must-ignore-if-unmodified-since-when-if-match-present',
      'rfc9110/recipient-must-ignore-range-when-if-range-false',
      'rfc9110/recipient-must-interpret-if-modified-since-value-in-terms-of-servers-clock',
      'rfc9110/recipient-must-interpret-if-unmodified-since-value-in-terms-of-servers-clock',
      'rfc9110/recipient-must-reject-http-uri-without-host',
      'rfc9110/recipient-must-reject-https-uri-without-host',
      'rfc9110/recipient-must-use-weak-comparison-for-if-none-match',
      'rfc9110/recipient-should-process-range-header-if-if-range-matches',
      'rfc9110/recipient-should-treat-userinfo-in-uri-from-untrusted-source-as-error',
      'rfc9110/sender-must-not-generate-http-uri-with-empty-host',
      'rfc9110/sender-must-not-generate-https-uri-with-empty-host',
      'rfc9110/sender-must-not-generate-userinfo-in-uri',
      'rfc9110/sender-recipient-should-support-8000-octet-uris',
      'rfc9110/server-must-evaluate-if-range',
      'rfc9110/server-must-evaluate-preconditions-after-normal-checks',
      'rfc9110/server-must-evaluate-preconditions-in-correct-order',
      'rfc9110/server-must-ignore-conditionals-for-connect-options-trace',
      'rfc9110/server-must-ignore-if-range-without-range',
      'rfc9110/server-must-ignore-preconditions-for-non-2xx-412-responses',
      'rfc9110/user-agent-must-handle-bad-certificate',
    ];

    it('has the expected rule count', () => {
      expect(scope.length).toBe(59);
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
    }, 30_000);
  });

  describe('message-context, message-abstraction and authentication batch (#161)', () => {
    const scope = [
      'rfc9110/authentication-parameter-name-must-occur-once-per-challenge',
      'rfc9110/authentication-scheme-must-accept-token-and-quoted-string',
      'rfc9110/client-may-proceed-to-send-content-without-receiving-100-response',
      'rfc9110/client-may-send-lower-version-for-broken-servers',
      'rfc9110/client-must-not-generate-100-continue-without-content',
      'rfc9110/client-must-not-send-non-conformant-version',
      'rfc9110/client-must-retain-knowledge-of-request',
      'rfc9110/client-must-send-expect-header-for-100-response',
      'rfc9110/client-should-not-wait-for-an-indefinite-period-for-100-response',
      'rfc9110/client-should-repeat-request-without-expect-for-417',
      'rfc9110/client-should-send-highest-conformant-version',
      'rfc9110/each-http-version-defines-own-framing',
      'rfc9110/header-field-term-for-header-section-only-fields',
      'rfc9110/header-fields-sent-before-content',
      'rfc9110/header-section-consists-of-field-lines',
      'rfc9110/implicit-framing-allowed-for-backwards-compatibility',
      'rfc9110/intermediary-should-not-modify-referer-for-same-scheme-and-host',
      'rfc9110/message-complete-when-framed-octets-available',
      'rfc9110/origin-server-may-generate-date-for-1xx-5xx',
      'rfc9110/origin-server-may-generate-server-header-field',
      'rfc9110/origin-server-may-send-allow-header',
      'rfc9110/origin-server-must-not-wait-for-content-before-100-continue',
      'rfc9110/origin-server-must-respond-immediately-to-100-continue-request',
      'rfc9110/origin-server-should-limit-addition-of-subproducts-by-third-parties',
      'rfc9110/origin-server-should-not-generate-needlessly-fine-grained-detail-server-header',
      'rfc9110/origin-server-should-send-401-for-invalid-credentials',
      'rfc9110/origin-server-with-clock-must-generate-date-for-2xx-3xx-4xx',
      'rfc9110/origin-server-without-clock-must-not-generate-date',
      'rfc9110/proxy-authenticate-applies-to-next-client',
      'rfc9110/proxy-may-generate-immediate-100-response',
      'rfc9110/proxy-may-relay-credentials',
      'rfc9110/proxy-must-handle-100-continue-expectation',
      'rfc9110/proxy-must-not-modify-allow-header',
      'rfc9110/proxy-must-not-modify-authentication-info',
      'rfc9110/proxy-must-not-modify-authorization',
      'rfc9110/proxy-must-not-modify-www-authenticate',
      'rfc9110/proxy-should-send-407-for-invalid-proxy-credentials',
      'rfc9110/realm-parameter-must-use-quoted-string-syntax',
      'rfc9110/recipient-may-replace-invalid-date',
      'rfc9110/recipient-may-treat-the-set-of-received-trailer-fields-as-name-value-pairs',
      'rfc9110/recipient-must-not-merge-trailers-unsafely',
      'rfc9110/recipient-should-process-higher-minor-version-as-highest-known',
      'rfc9110/recipient-with-clock-must-add-date-if-missing',
      'rfc9110/robotic-user-agent-should-send-valid-from-header',
      'rfc9110/sender-must-not-generate-advertising-in-product-identifier',
      'rfc9110/sender-must-not-generate-trailer-unless-permitted',
      'rfc9110/sender-must-send-te-connection-option-with-te-header',
      'rfc9110/sender-should-generate-date-at-message-generation',
      'rfc9110/sender-should-generate-trailer-header-when-sending-trailers',
      'rfc9110/sender-should-limit-generated-product-identifiers-to-necessity',
      'rfc9110/sender-should-not-generate-non-version-info-in-product-version',
      'rfc9110/server-may-omit-sending-100-response-if-already-received-content',
      'rfc9110/server-may-respond-with-417-response-for-other-expect-than-100-continue',
      'rfc9110/server-may-send-www-authenticate-in-other-responses',
      'rfc9110/server-must-ignore-100-continue-in-http-1.0',
      'rfc9110/server-must-not-send-non-conformant-version',
      'rfc9110/server-must-send-final-status-after-100-continue',
      'rfc9110/server-should-indicate-if-closing-the-connection-when-sending-final-status-code-without-full-request',
      'rfc9110/server-should-not-generate-necessary-trailers',
      'rfc9110/server-should-not-use-from-for-authentication',
      'rfc9110/server-should-send-response-version-equal-to-highest-conformant',
      'rfc9110/trailer-fields-must-be-defined-as-list-if-repeatable',
      'rfc9110/user-agent-may-reuse-same-credentials-for-identical-protection-space',
      'rfc9110/user-agent-may-send-date-header-in-request',
      'rfc9110/user-agent-may-truncate-parts-other-than-referring-origin',
      'rfc9110/user-agent-must-exclude-referer-or-send-about-blank-for-no-source',
      'rfc9110/user-agent-must-inherit-fragment-for-3xx-without-fragment',
      'rfc9110/user-agent-must-not-include-fragment-or-userinfo-in-referer',
      'rfc9110/user-agent-must-not-send-referer-in-unsecured-request-from-secure-resource',
      'rfc9110/user-agent-should-limit-addition-of-subproducts-by-third-parties',
      'rfc9110/user-agent-should-not-generate-needlessly-fine-grained-detailed-user-agent-field',
      'rfc9110/user-agent-should-not-send-from-without-configuration',
      'rfc9110/user-agent-should-not-send-referer-for-secure-to-insecure',
      'rfc9110/user-agent-should-send-user-agent-header',
    ];

    it('has the expected rule count', () => {
      expect(scope.length).toBe(74);
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
