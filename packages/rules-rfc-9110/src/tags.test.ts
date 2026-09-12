import { allRuleTags, loadRules } from '@thymian/core';
import { describe, expect, it } from 'vitest';

// Batch 1 of the concern-tag sweep (thymian-workspace#93): identifiers,
// authentication, message-context — the three densest directories, judged
// as a pilot batch before the rest of the corpus. Each list is this batch's
// own drift guard, the same convention `profiles.test.ts` uses for the
// shipped profiles: a renamed or removed rule fails this test loudly rather
// than silently dropping out of the census.

const identifiersRuleIds = [
  'rfc9110/automated-client-must-log-error-to-audit-log-for-bad-certificate',
  'rfc9110/automated-client-should-terminate-connection-for-bad-certificate',
  'rfc9110/automated-clients-may-provide-setting-to-disable-certificate-check',
  'rfc9110/automated-clients-must-provide-setting-to-enable-certificate-check',
  'rfc9110/client-may-access-by-resolving-host-to-ip-address',
  'rfc9110/client-must-construct-reference-identity',
  'rfc9110/client-must-not-use-cn-id-reference-identity',
  'rfc9110/client-must-use-rfc6125-verification',
  'rfc9110/client-must-verify-service-identity',
  'rfc9110/user-agent-must-handle-bad-certificate',
  'rfc9110/recipient-must-reject-http-uri-without-host',
  'rfc9110/sender-must-not-generate-http-uri-with-empty-host',
  'rfc9110/client-must-secure-https-requests-and-responses',
  'rfc9110/recipient-must-reject-https-uri-without-host',
  'rfc9110/sender-must-not-generate-https-uri-with-empty-host',
  'rfc9110/authority-should-not-use-equivalent-uris-for-distinct-resources',
  'rfc9110/http-component-may-perform-normalization',
  'rfc9110/sender-recipient-should-support-8000-octet-uris',
  'rfc9110/recipient-should-treat-userinfo-in-uri-from-untrusted-source-as-error',
  'rfc9110/sender-must-not-generate-userinfo-in-uri',
];

const authenticationRuleIds = [
  'rfc9110/origin-server-should-send-401-for-invalid-credentials',
  'rfc9110/proxy-should-send-407-for-invalid-proxy-credentials',
  'rfc9110/proxy-must-not-modify-authentication-info',
  'rfc9110/proxy-must-not-modify-authorization',
  'rfc9110/proxy-must-not-modify-www-authenticate',
  'rfc9110/server-may-send-www-authenticate-in-other-responses',
  'rfc9110/authentication-parameter-name-must-occur-once-per-challenge',
  'rfc9110/authentication-scheme-must-accept-token-and-quoted-string',
  'rfc9110/proxy-authenticate-applies-to-next-client',
  'rfc9110/proxy-may-relay-credentials',
  'rfc9110/realm-parameter-must-use-quoted-string-syntax',
  'rfc9110/user-agent-may-reuse-same-credentials-for-identical-protection-space',
];

const messageContextRuleIds = [
  'rfc9110/client-may-proceed-to-send-content-without-receiving-100-response',
  'rfc9110/client-must-not-generate-100-continue-without-content',
  'rfc9110/client-must-send-expect-header-for-100-response',
  'rfc9110/client-should-not-wait-for-an-indefinite-period-for-100-response',
  'rfc9110/client-should-repeat-request-without-expect-for-417',
  'rfc9110/origin-server-must-not-wait-for-content-before-100-continue',
  'rfc9110/origin-server-must-respond-immediately-to-100-continue-request',
  'rfc9110/proxy-may-generate-immediate-100-response',
  'rfc9110/proxy-must-handle-100-continue-expectation',
  'rfc9110/server-may-omit-sending-100-response-if-already-received-content',
  'rfc9110/server-may-respond-with-417-response-for-other-expect-than-100-continue',
  'rfc9110/server-must-ignore-100-continue-in-http-1.0',
  'rfc9110/server-must-send-final-status-after-100-continue',
  'rfc9110/server-should-indicate-if-closing-the-connection-when-sending-final-status-code-without-full-request',
  'rfc9110/robotic-user-agent-should-send-valid-from-header',
  'rfc9110/server-should-not-use-from-for-authentication',
  'rfc9110/user-agent-should-not-send-from-without-configuration',
  'rfc9110/intermediary-should-not-modify-referer-for-same-scheme-and-host',
  'rfc9110/user-agent-may-truncate-parts-other-than-referring-origin',
  'rfc9110/user-agent-must-exclude-referer-or-send-about-blank-for-no-source',
  'rfc9110/user-agent-must-not-include-fragment-or-userinfo-in-referer',
  'rfc9110/user-agent-must-not-send-referer-in-unsecured-request-from-secure-resource',
  'rfc9110/user-agent-should-not-send-referer-for-secure-to-insecure',
  'rfc9110/sender-must-send-te-connection-option-with-te-header',
  'rfc9110/sender-must-not-generate-advertising-in-product-identifier',
  'rfc9110/sender-should-limit-generated-product-identifiers-to-necessity',
  'rfc9110/sender-should-not-generate-non-version-info-in-product-version',
  'rfc9110/user-agent-should-limit-addition-of-subproducts-by-third-parties',
  'rfc9110/user-agent-should-not-generate-needlessly-fine-grained-detailed-user-agent-field',
  'rfc9110/user-agent-should-send-user-agent-header',
  'rfc9110/origin-server-may-send-allow-header',
  'rfc9110/proxy-must-not-modify-allow-header',
  'rfc9110/user-agent-must-inherit-fragment-for-3xx-without-fragment',
  'rfc9110/origin-server-may-generate-server-header-field',
  'rfc9110/origin-server-should-limit-addition-of-subproducts-by-third-parties',
  'rfc9110/origin-server-should-not-generate-needlessly-fine-grained-detail-server-header',
];

describe('concern tag sweep — batch 1 (identifiers, authentication, message-context)', () => {
  it('resolves every id in this batch to a real rule', async () => {
    const rules = await loadRules('@thymian/rules-rfc-9110');
    const ruleIds = new Set(rules.map((rule) => rule.meta.name));

    for (const id of [
      ...identifiersRuleIds,
      ...authenticationRuleIds,
      ...messageContextRuleIds,
    ]) {
      expect(ruleIds.has(id), `"${id}" is not a real rule`).toBe(true);
    }
  }, 30_000);

  it('tags 12 of the 20 `identifiers` rules', async () => {
    const rules = await loadRules('@thymian/rules-rfc-9110');
    const byId = new Map(rules.map((rule) => [rule.meta.name, rule]));

    expect(identifiersRuleIds.length).toBe(20);

    const tagged = identifiersRuleIds.filter(
      (id) => (byId.get(id)?.meta.tags?.length ?? 0) > 0,
    );
    expect(tagged.length).toBe(12);
  }, 30_000);

  it('tags 6 of the 12 `authentication` rules', async () => {
    const rules = await loadRules('@thymian/rules-rfc-9110');
    const byId = new Map(rules.map((rule) => [rule.meta.name, rule]));

    expect(authenticationRuleIds.length).toBe(12);

    const tagged = authenticationRuleIds.filter(
      (id) => (byId.get(id)?.meta.tags?.length ?? 0) > 0,
    );
    expect(tagged.length).toBe(6);
  }, 30_000);

  it('tags 15 of the 36 `message-context` rules', async () => {
    const rules = await loadRules('@thymian/rules-rfc-9110');
    const byId = new Map(rules.map((rule) => [rule.meta.name, rule]));

    expect(messageContextRuleIds.length).toBe(36);

    const tagged = messageContextRuleIds.filter(
      (id) => (byId.get(id)?.meta.tags?.length ?? 0) > 0,
    );
    expect(tagged.length).toBe(15);
  }, 30_000);

  it('carries no tag outside the exported vocabulary', async () => {
    const rules = await loadRules('@thymian/rules-rfc-9110');
    const byId = new Map(rules.map((rule) => [rule.meta.name, rule]));

    for (const id of [
      ...identifiersRuleIds,
      ...authenticationRuleIds,
      ...messageContextRuleIds,
    ]) {
      for (const tag of byId.get(id)?.meta.tags ?? []) {
        expect(allRuleTags, `"${tag}" on "${id}"`).toContain(tag);
      }
    }
  }, 30_000);
});
