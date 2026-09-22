// The anchor map for #156's denominator (`./coverage.ts`): every distinct
// URL fragment the 402-rule corpus cites today, resolved to the RFC 9110
// section it targets. A labour-saving device for seeding a rule's `covers`
// when #157-#162 populate `coverage.ts`'s `rules` — reviewed per rule, never
// authoritative on its own, since `.url()` says where a rule is explained,
// not proof of what it covers.
//
// 123 distinct fragments (88 named, 35 numeric) across the 400 rules that
// carry a `.url()`. The two that don't are mapped by hand below, from their
// content: both assert a MAY about the `Content-Language` header field
// (RFC 9110 §8.5, itself a unit), so both seed `covers: ['8.5']`.
//
// 10 of the 123 resolve to a section with no keyword of its own — an
// informational citation (e.g. explaining what "402 Payment Required"
// means, not asserting a requirement) rather than a stale mapping. Each is
// commented rather than silently resolved, so a batch author sees the gap
// instead of an id that turns out not to be in `units`.
//
// Two named anchors don't resolve against the live RFC page at all:
// `#name-deprecation-of-userinfo-in-http` and
// `#name-https-normalization-and-comparison`, cited by
// `authority-should-not-use-equivalent-uris-for-distinct-resources`,
// `http-component-may-perform-normalization`,
// `recipient-should-treat-userinfo-in-uri-from-untrusted-source-as-error`
// and `sender-must-not-generate-userinfo-in-uri` — rfc-editor.org truncates
// its generated heading ids (`name-deprecation-of-userinfo-in-`,
// `name-https-normalization-and-com`) below what those four rules cite.
// Filed as thymianofficial/thymian-workspace#168 (a corpus citation bug,
// out of this ticket's scope); resolved here against the real target
// (§4.2.4 and §4.2.3, both units) regardless, so the anchor map stays
// useful in the meantime.

export const rfc9110CitedDocument =
  'https://www.rfc-editor.org/rfc/rfc9110.html';

export const rfc9110AnchorMap: Record<string, string> = {
  // Numeric anchors (35) — the fragment already names the section.
  '#section-5.1': '5.1',
  '#section-5.3': '5.3',
  '#section-5.4': '5.4',
  '#section-5.5': '5.5',
  '#section-5.6.1': '5.6.1', // no direct keyword — not a units key; informational citation
  '#section-5.6.3': '5.6.3',
  '#section-5.6.4': '5.6.4',
  '#section-5.6.7': '5.6.7',
  '#section-6.1': '6.1', // no direct keyword — not a units key; informational citation
  '#section-6.2': '6.2',
  '#section-6.3': '6.3', // no direct keyword — not a units key; informational citation
  '#section-6.5.1': '6.5.1',
  '#section-6.5.2': '6.5.2',
  '#section-6.6.1': '6.6.1',
  '#section-6.6.2': '6.6.2',
  '#section-8.3': '8.3',
  '#section-8.3.3': '8.3.3',
  '#section-8.4': '8.4',
  '#section-8.4.1.1': '8.4.1.1',
  '#section-8.4.1.3': '8.4.1.3',
  '#section-8.6': '8.6',
  '#section-8.7': '8.7',
  '#section-8.8.1': '8.8.1',
  '#section-8.8.2.1': '8.8.2.1',
  '#section-8.8.3': '8.8.3',
  '#section-8.8.3.1': '8.8.3.1',
  '#section-8.8.3.2': '8.8.3.2', // no direct keyword — not a units key; informational citation
  '#section-8.8.3.3': '8.8.3.3', // no direct keyword — not a units key; informational citation
  '#section-13.1.1': '13.1.1',
  '#section-13.1.2': '13.1.2',
  '#section-13.1.3': '13.1.3',
  '#section-13.1.4': '13.1.4',
  '#section-13.1.5': '13.1.5',
  '#section-13.2.1': '13.2.1',
  '#section-13.2.2': '13.2.2',

  // Named anchors (88) — resolved against the section that wraps the heading.
  '#name-101-switching-protocols': '15.2.2',
  '#name-200-ok': '15.3.1',
  '#name-205-reset-content': '15.3.6',
  '#name-206-partial-content': '15.3.7',
  '#name-300-multiple-choices': '15.4.1',
  '#name-301-moved-permanently': '15.4.2',
  '#name-302-found': '15.4.3',
  '#name-304-not-modified': '15.4.5',
  '#name-305-use-proxy': '15.4.6', // no direct keyword — not a units key; informational citation
  '#name-306-unused': '15.4.7', // no direct keyword — not a units key; informational citation
  '#name-307-temporary-redirect': '15.4.8',
  '#name-308-permanent-redirect': '15.4.9',
  '#name-401-unauthorized': '15.5.2',
  '#name-402-payment-required': '15.5.3', // no direct keyword — not a units key; informational citation
  '#name-403-forbidden': '15.5.4',
  '#name-405-method-not-allowed': '15.5.6',
  '#name-406-not-acceptable': '15.5.7',
  '#name-407-proxy-authentication-re': '15.5.8',
  '#name-408-request-timeout': '15.5.9',
  '#name-409-conflict': '15.5.10',
  '#name-411-length-required': '15.5.12',
  '#name-413-content-too-large': '15.5.14',
  '#name-416-range-not-satisfiable': '15.5.17',
  '#name-421-misdirected-request': '15.5.20',
  '#name-426-upgrade-required': '15.5.22',
  '#name-503-service-unavailable': '15.6.4',
  '#name-505-http-version-not-suppor': '15.6.6',
  '#name-accept': '12.5.1',
  '#name-accept-charset': '12.5.2',
  '#name-accept-encoding': '12.5.3',
  '#name-accept-language': '12.5.4',
  '#name-accept-ranges': '14.3',
  '#name-allow': '10.2.1',
  '#name-authenticating-clients-to-p': '11.7', // no direct keyword — not a units key; informational citation
  '#name-authenticating-users-to-ori': '11.6', // no direct keyword — not a units key; informational citation
  '#name-authentication-parameters': '11.2',
  '#name-byte-ranges': '14.1.2',
  '#name-client-error-4xx': '15.5',
  '#name-combining-parts': '15.3.7.3',
  '#name-connect': '9.3.6',
  '#name-connection': '7.6.1',
  '#name-content-range': '14.4',
  '#name-credentials': '11.4',
  '#name-delete': '9.3.5',
  '#name-deprecation-of-userinfo-in-http': '4.2.4',
  '#name-determining-the-target-reso': '7.1',
  '#name-establishing-a-protection-s': '11.5',
  '#name-expect': '10.1.1',
  '#name-from': '10.1.2',
  '#name-get': '9.3.1',
  '#name-head': '9.3.2',
  '#name-host-and-authority': '7.2',
  '#name-http-origins': '4.3.2',
  '#name-http-uri-scheme': '4.2.1',
  '#name-https-certificate-verificat': '4.3.4',
  '#name-https-normalization-and-comparison': '4.2.3',
  '#name-https-uri-scheme': '4.2.2',
  '#name-idempotent-methods': '9.2.2',
  '#name-informational-1xx': '15.2',
  '#name-location': '10.2.2',
  '#name-max-forwards': '7.6.2',
  '#name-message-abstraction': '6',
  '#name-message-forwarding': '7.6',
  '#name-message-transformations': '7.7',
  '#name-multiple-parts': '15.3.7.2',
  '#name-options': '9.3.7',
  '#name-overview': '9.1',
  '#name-partial-put': '14.5',
  '#name-post': '9.3.3',
  '#name-proactive-negotiation': '12.1',
  '#name-put': '9.3.4',
  '#name-range': '14.2',
  '#name-redirection-3xx': '15.4',
  '#name-referer': '10.1.3',
  '#name-rejecting-misdirected-reque': '7.4',
  '#name-response-correlation': '7.5',
  '#name-safe-methods': '9.2.1',
  '#name-server': '10.2.4',
  '#name-server-error-5xx': '15.6',
  '#name-single-part': '15.3.7.1',
  '#name-status-codes': '15',
  '#name-te': '10.1.4',
  '#name-trace': '9.3.8',
  '#name-upgrade': '7.8',
  '#name-uri-references': '4.1',
  '#name-user-agent': '10.1.5',
  '#name-vary': '12.5.5',
  '#name-via': '7.6.3',

  // No `.url()` at all — mapped by hand from content (both assert a MAY
  // about Content-Language, RFC 9110 §8.5):
  'rfc9110/content-language-may-be-applied-to-any-media-type': '8.5',
  'rfc9110/multiple-languages-may-be-listed-for-multiple-audiences': '8.5',
};
