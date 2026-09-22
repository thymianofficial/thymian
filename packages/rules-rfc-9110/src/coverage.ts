// RFC 9110's denominator (ADR-0021 §5, #156). RFC 9110 §17 itself enumerates
// no normative statements of its own — zero BCP 14 keywords in 27,018
// characters — so this package's unit is a **substitute**: one numbered
// section, anywhere in the document, that carries at least one BCP 14
// requirement-level keyword addressed to an HTTP participant. A section is
// not a statement, hence the substitute label.
//
// Counted from the document, never from the corpus: derived by walking the
// published RFC 9110 HTML (https://www.rfc-editor.org/rfc/rfc9110.html,
// June 2022) section by section and recording which of its own 291 numbered
// sections contain at least one of MUST, MUST NOT, SHALL, SHALL NOT, SHOULD,
// SHOULD NOT, MAY, REQUIRED, RECOMMENDED, NOT RECOMMENDED, OPTIONAL directly
// in their own text (not counting a keyword that only appears in a nested
// subsection — that subsection is its own, separate unit). 138 of 291
// numbered sections qualify; n = 138.
//
// This intentionally does **not** derive from what the 402 rules already
// cite: several keyword-bearing sections have no rule pointing at them
// today (see the PR for the list), which is exactly what a denominator
// counted from the corpus itself could never reveal.
//
// `rules` ships empty here on purpose — populating it is #157-#162's job,
// seeded from `./coverage-anchor-map.ts`.

import { type CoverageRecord, defineCoverage } from '@thymian/core';

// `units` is named and `as const` on its own, and `coverage` carries an
// explicit `CoverageRecord<typeof units>` annotation, rather than letting
// `export default` infer straight off `defineCoverage(...)`'s return: with
// 250+ entries in `rules` below, TS's declaration emit hits "the inferred
// type of this node exceeds the maximum length the compiler will
// serialize" trying to print the fully-mapped `{ [RuleName in keyof
// Rules]: CoverageEntry<Units> }` return type. `defineCoverage`'s own call
// below still infers `Rules` from the literal and checks every entry
// against `CoverageEntry<Units>` exactly as before -- only the *exported*
// type widens, from the per-key mapped type to `CoverageRecord`'s default
// `Record<string, CoverageEntry<Units>>`, which is what actually needed
// serializing and is representationally identical for every consumer here
// (`checkCoverage`, `renderCoverage`, `generate-coverage.ts`, the scoped
// tests below), none of which key into `rules` by a literal rule name.
const units = {
  '2.2': 'Requirements Notation',
  '2.3': 'Length Requirements',
  '2.4': 'Error Handling',
  '3.3': 'Connections, Clients, and Servers',
  '3.8': 'Caches',
  '4.1': 'URI References',
  '4.2.1': 'http URI Scheme',
  '4.2.2': 'https URI Scheme',
  '4.2.3': 'http(s) Normalization and Comparison',
  '4.2.4': 'Deprecation of userinfo in http(s) URIs',
  '4.3.2': 'http Origins',
  '4.3.3': 'https Origins',
  '4.3.4': 'https Certificate Verification',
  '5.1': 'Field Names',
  '5.3': 'Field Order',
  '5.4': 'Field Limits',
  '5.5': 'Field Values',
  '5.6.1.1': 'Sender Requirements',
  '5.6.1.2': 'Recipient Requirements',
  '5.6.3': 'Whitespace',
  '5.6.4': 'Quoted Strings',
  '5.6.7': 'Date/Time Formats',
  '6': 'Message Abstraction',
  '6.2': 'Control Data',
  '6.5.1': 'Limitations on Use of Trailers',
  '6.5.2': 'Processing Trailer Fields',
  '6.6.1': 'Date',
  '6.6.2': 'Trailer',
  '7.1': 'Determining the Target Resource',
  '7.2': 'Host and :authority',
  '7.4': 'Rejecting Misdirected Requests',
  '7.5': 'Response Correlation',
  '7.6': 'Message Forwarding',
  '7.6.1': 'Connection',
  '7.6.2': 'Max-Forwards',
  '7.6.3': 'Via',
  '7.7': 'Message Transformations',
  '7.8': 'Upgrade',
  '8.3': 'Content-Type',
  '8.3.1': 'Media Type',
  '8.3.3': 'Multipart Types',
  '8.4': 'Content-Encoding',
  '8.4.1.1': 'Compress Coding',
  '8.4.1.3': 'Gzip Coding',
  '8.5': 'Content-Language',
  '8.6': 'Content-Length',
  '8.7': 'Content-Location',
  '8.8.1': 'Weak versus Strong',
  '8.8.2.1': 'Generation',
  '8.8.3': 'ETag',
  '8.8.3.1': 'Generation',
  '9.1': 'Overview',
  '9.2.1': 'Safe Methods',
  '9.2.2': 'Idempotent Methods',
  '9.3.1': 'GET',
  '9.3.2': 'HEAD',
  '9.3.3': 'POST',
  '9.3.4': 'PUT',
  '9.3.5': 'DELETE',
  '9.3.6': 'CONNECT',
  '9.3.7': 'OPTIONS',
  '9.3.8': 'TRACE',
  '10.1.1': 'Expect',
  '10.1.2': 'From',
  '10.1.3': 'Referer',
  '10.1.4': 'TE',
  '10.1.5': 'User-Agent',
  '10.2.1': 'Allow',
  '10.2.2': 'Location',
  '10.2.4': 'Server',
  '11.2': 'Authentication Parameters',
  '11.4': 'Credentials',
  '11.5': 'Establishing a Protection Space (Realm)',
  '11.6.1': 'WWW-Authenticate',
  '11.6.2': 'Authorization',
  '11.7.1': 'Proxy-Authenticate',
  '11.7.2': 'Proxy-Authorization',
  '12.1': 'Proactive Negotiation',
  '12.4.2': 'Quality Values',
  '12.5.1': 'Accept',
  '12.5.2': 'Accept-Charset',
  '12.5.3': 'Accept-Encoding',
  '12.5.4': 'Accept-Language',
  '12.5.5': 'Vary',
  '13.1.1': 'If-Match',
  '13.1.2': 'If-None-Match',
  '13.1.3': 'If-Modified-Since',
  '13.1.4': 'If-Unmodified-Since',
  '13.1.5': 'If-Range',
  '13.2.1': 'When to Evaluate',
  '13.2.2': 'Precedence of Preconditions',
  '14': 'Range Requests',
  '14.1.2': 'Byte Ranges',
  '14.2': 'Range',
  '14.3': 'Accept-Ranges',
  '14.4': 'Content-Range',
  '14.5': 'Partial PUT',
  '15': 'Status Codes',
  '15.2': 'Informational 1xx',
  '15.2.2': '101 Switching Protocols',
  '15.3.1': '200 OK',
  '15.3.6': '205 Reset Content',
  '15.3.7': '206 Partial Content',
  '15.3.7.1': 'Single Part',
  '15.3.7.2': 'Multiple Parts',
  '15.3.7.3': 'Combining Parts',
  '15.4': 'Redirection 3xx',
  '15.4.1': '300 Multiple Choices',
  '15.4.2': '301 Moved Permanently',
  '15.4.3': '302 Found',
  '15.4.5': '304 Not Modified',
  '15.4.8': '307 Temporary Redirect',
  '15.4.9': '308 Permanent Redirect',
  '15.5': 'Client Error 4xx',
  '15.5.2': '401 Unauthorized',
  '15.5.4': '403 Forbidden',
  '15.5.6': '405 Method Not Allowed',
  '15.5.7': '406 Not Acceptable',
  '15.5.8': '407 Proxy Authentication Required',
  '15.5.9': '408 Request Timeout',
  '15.5.10': '409 Conflict',
  '15.5.12': '411 Length Required',
  '15.5.14': '413 Content Too Large',
  '15.5.17': '416 Range Not Satisfiable',
  '15.5.20': '421 Misdirected Request',
  '15.5.22': '426 Upgrade Required',
  '15.6': 'Server Error 5xx',
  '15.6.4': '503 Service Unavailable',
  '15.6.6': '505 HTTP Version Not Supported',
  '16.1.1': 'Method Registry',
  '16.2.1': 'Status Code Registry',
  '16.3.1': 'Field Name Registry',
  '16.3.2.1': 'Considerations for New Field Names',
  '16.4.1': 'Authentication Scheme Registry',
  '16.4.2': 'Considerations for New Authentication Schemes',
  '16.5.1': 'Range Unit Registry',
  '16.6.1': 'Content Coding Registry',
  '16.7': 'Upgrade Token Registry',
} as const;

const coverage: CoverageRecord<typeof units> = defineCoverage({
  source: {
    revision: 'RFC 9110 (June 2022)',
    countingRule:
      'One unit per numbered section carrying at least one BCP 14 ' +
      'requirement-level keyword (MUST, MUST NOT, SHALL, SHALL NOT, ' +
      'SHOULD, SHOULD NOT, MAY, REQUIRED, RECOMMENDED, NOT RECOMMENDED, ' +
      'OPTIONAL) addressed to an HTTP participant.',
    hasKeywordBasis: true,
    substituteLabel: 'section',
  },
  units,
  rules: {
    'rfc9110/402-status-code-is-reserved': {
      covers: [],
      declared: { types: ['static', 'analytics'], severity: 'error' },
      contexts: {
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "402 has no defined meaning, so no conformant API operation would document it as an expected response; test's per-operation expected-status model has no scenario to run this check against.",
        },
      },
    },
    'rfc9110/client-may-combine-multiple-ranges-with-same-strong-validator-to-larger-range':
      {
        covers: ['15.3.7.3'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/client-may-repeat-request-for-408-response': {
      covers: ['15.5.9'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/client-may-repeat-request-with-new-credentials-for-403-response': {
      covers: ['15.5.4'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/client-may-repeat-request-with-new-proxy-authenticate-header-for-407-response':
      {
        covers: ['15.5.8'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/client-may-repeat-request-with-valid-content-length-header-for-411-response':
      {
        covers: ['15.5.12'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/client-may-retry-after-given-time-for-413-response': {
      covers: ['15.5.14'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/client-may-retry-request-over-different-connection': {
      covers: ['15.5.20'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/client-must-be-able-to-parse-multiple-1xx-responses': {
      covers: ['15.2'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/client-must-inspect-206-response-content-type-and-range': {
      covers: ['15.3.7'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/client-must-inspect-content-range-header-in-multiple-parts-206-response':
      {
        covers: ['15.3.7.2'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/client-must-not-generate-multiple-ranges-request-if-not-supported':
      {
        covers: ['15.3.7.2'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/client-must-process-combined-response-correct': {
      covers: ['15.3.7.3'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/client-must-understand-class-of-any-status-code': {
      covers: ['15'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/client-must-use-other-header-fields-provided-in-new-for-206-response':
      {
        covers: ['15.3.7.3'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/client-should-not-automatically-repeat-request-for-403-response': {
      covers: ['15.5.4'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/client-should-process-invalid-status-code-as-5xx': {
      covers: ['15'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/clients-should-detect-and-intervene-cyclical-redirections': {
      covers: ['15.4'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/origin-server-may-respond-with-404-instead-of-403': {
      covers: ['15.5.4'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'hint' },
    },
    'rfc9110/origin-server-must-generate-allow-header-for-405-response': {
      covers: ['15.5.6'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'error' },
    },
    'rfc9110/proxy-must-forward-1xx-responses': {
      covers: ['15.2'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/proxy-must-not-send-421-response': {
      covers: ['15.5.20'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'This rule needs to know whether the 421 itself came from a proxy versus the origin -- a fact about which participant generated the response, not about the response body or headers, and the schema carries no participant-role dimension to check it against.',
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: 'A 421 legitimately means something different depending on who sent it (a proxy MUST NOT; an origin server MAY), but a direct test exchange gives Thymian no signal for which one answered -- it only occupies the client role, never a position to see the responding participant’s identity.',
        },
      },
    },
    'rfc9110/proxy-must-send-proxy-authenticate-header-for-407-response': {
      covers: ['15.5.8'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'This obligation only binds a 407 that a proxy itself generated, scoped by meta.role on the captured response -- the schema has no notion of which participant produced a given documented response, so it cannot express that scope at all.',
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: 'The check needs to confirm a specific challenge came from the proxy that returned the 407, not the origin; a direct test exchange never carries that per-hop attribution, since Thymian only ever occupies the client role in it.',
        },
      },
    },
    'rfc9110/proxy-should-forward-304-response-to-outbound-client': {
      covers: ['15.4.5'],
      declared: { types: ['analytics'], severity: 'warn' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'The schema format has no concept of a correlated multi-hop trace or of participant role -- both of which this rule needs to compare the client-facing and origin-facing legs.',
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: 'A test fixture produces one direct request/response pair per run; Thymian cannot position itself to observe both the outbound-client leg and the origin leg of a proxied chain at once.',
        },
      },
    },
    'rfc9110/sender-should-not-generate-additional-representation-header-fields-for-206-response':
      {
        covers: ['15.3.7'],
        declared: { types: ['static', 'test', 'analytics'], severity: 'error' },
      },
    'rfc9110/sender-should-not-generate-additional-representation-metadata-for-304-response':
      {
        covers: ['15.4.5'],
        declared: { types: ['static', 'analytics', 'test'], severity: 'warn' },
      },
    'rfc9110/server-may-close-connection-for-413-response': {
      covers: ['15.5.14'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/server-may-coalesce-overlapping-or-small-gapped-ranges': {
      covers: ['15.3.7.2'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/server-may-generate-multiple-parts-response-with-single-body': {
      covers: ['15.3.7.2'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/server-may-send-retry-after-header-for-503-response': {
      covers: ['15.6.4'],
      declared: { types: ['analytics'], severity: 'hint' },
      contexts: {
        // Likely a mis-declaration, not a real impossibility: the check is a
        // bare header-name presence test, which the common interface can
        // see in static too (executability-gate.md: "not observable in
        // static" is a claim about pinning a *value*, never about the
        // context being name-only). Whether a given target's own OpenAPI
        // spec happens to document Retry-After for 503 varies per target —
        // exactly the "specification does not pin the value" trap the same
        // reference names as *not* an impossibility reason. The rule's own
        // `.rule()` has no static/lint handler wired up today, so nothing
        // runs here regardless; filed as thymianofficial/thymian-workspace#169
        // rather than declaring static on a rule this ticket leaves
        // untouched.
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'No static/lint handler is wired up on this rule today. Likely a mis-declaration rather than a structural impossibility — see thymianofficial/thymian-workspace#169.',
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "503 signals genuine server overload or maintenance; Thymian's test harness cannot provoke that operational condition on demand from a healthy target.",
        },
      },
    },
    'rfc9110/server-may-terminate-request-for-413-response': {
      covers: ['15.5.14'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/server-must-generate-content-range-header-for-single-part-206-response':
      {
        covers: ['15.3.7.1'],
        declared: { types: ['static', 'analytics', 'test'], severity: 'error' },
      },
    'rfc9110/server-must-generate-content-range-header-in-corresponding-body-part-for-206-response':
      {
        covers: ['15.3.7.2'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/server-must-generate-header-fields-for-206-response': {
      covers: ['15.3.7'],
      declared: { types: ['static', 'test', 'analytics'], severity: 'error' },
    },
    'rfc9110/server-must-generate-header-fields-for-304-response': {
      covers: ['15.4.5'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'error' },
    },
    'rfc9110/server-must-generate-multipart-byteranges-content-for-multi-part-206-response':
      {
        covers: ['15.3.7.2'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/server-must-generate-upgrade-header-field': {
      covers: ['15.2.2'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/server-must-not-generate-content-for-205-response': {
      covers: ['15.3.6'],
      declared: { types: ['test', 'static', 'analytics'], severity: 'error' },
    },
    'rfc9110/server-must-not-generate-content-range-header-for-multi-part-206-response':
      {
        covers: ['15.3.7.2'],
        declared: { types: ['static', 'analytics', 'test'], severity: 'error' },
      },
    'rfc9110/server-must-not-generate-multipart-response-to-a-single-part-request':
      {
        covers: ['15.3.7.2'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/server-must-not-send-1xx-response-to-1.0-client': {
      covers: ['15.2'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/server-must-send-upgrade-header-for-426-response': {
      covers: ['15.5.22'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'error' },
    },
    'rfc9110/server-must-send-www-authenticate-header-for-401-response': {
      covers: ['15.5.2'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'error' },
    },
    'rfc9110/server-should-generate-content-for-300-response': {
      covers: ['15.4.1'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'warn' },
    },
    'rfc9110/server-should-generate-content-for-406-response': {
      covers: ['15.5.7'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'warn' },
    },
    'rfc9110/server-should-generate-content-for-409-response': {
      covers: ['15.5.10'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'warn' },
    },
    'rfc9110/server-should-generate-content-range-header-for-416-response': {
      covers: ['15.5.17'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'warn' },
    },
    'rfc9110/server-should-generate-content-type-header-in-body-for-206-response':
      {
        covers: ['15.3.7.2'],
        declared: { types: ['informational'], severity: 'warn' },
      },
    'rfc9110/server-should-generate-location-header-field-for-301-response': {
      covers: ['15.4.2'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'warn' },
    },
    'rfc9110/server-should-generate-location-header-for-302-response': {
      covers: ['15.4.3'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'warn' },
    },
    'rfc9110/server-should-generate-location-header-for-307-response': {
      covers: ['15.4.8'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'warn' },
    },
    'rfc9110/server-should-generate-location-header-for-308-response': {
      covers: ['15.4.9'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'warn' },
    },
    'rfc9110/server-should-generate-location-header-for-preferred-choice-for-300-response':
      {
        covers: ['15.4.1'],
        declared: { types: ['static', 'analytics', 'test'], severity: 'warn' },
      },
    'rfc9110/server-should-generate-representation-for-505-response': {
      covers: ['15.6.6'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'warn' },
    },
    'rfc9110/server-should-generate-retry-after-header-for-413-response': {
      covers: ['15.5.14'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'warn' },
    },
    'rfc9110/server-should-send-error-representation-for-4xx-responses': {
      covers: ['15.5'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'warn' },
    },
    'rfc9110/server-should-send-error-representation-for-5xx-response': {
      covers: ['15.6'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'warn' },
    },
    'rfc9110/server-should-send-parts-in-order-of-range-header': {
      covers: ['15.3.7.2'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/server-should-send-validator-fields': {
      covers: ['15.3.1'],
      declared: { types: ['static', 'test', 'analytics'], severity: 'warn' },
    },
    'rfc9110/status-code-305-is-deprecated': {
      covers: [],
      declared: { types: ['static', 'analytics'], severity: 'error' },
      contexts: {
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: '305 is deprecated with no current server expected to emit it, so no conformant API operation would document it as an expected response for test to provoke.',
        },
      },
    },
    'rfc9110/status-code-306-is-reserved': {
      covers: [],
      declared: { types: ['static', 'analytics'], severity: 'error' },
      contexts: {
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: '306 is unused and reserved, so no conformant API operation would document it as an expected response for test to provoke.',
        },
      },
    },
    'rfc9110/user-agent-may-change-request-method-from-post-to-get-for-301-response':
      {
        covers: ['15.4.2'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/user-agent-may-change-request-method-from-post-to-get-for-302-response':
      {
        covers: ['15.4.3'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/user-agent-may-redirect-to-location-header-uri-for-3xx-response': {
      covers: ['15.4'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/user-agent-may-repeat-request-with-new-authorization-header': {
      covers: ['15.5.2'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/user-agent-may-select-most-appropriate-choice-for-406-response': {
      covers: ['15.5.7'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/user-agent-may-select-redirection-from-content': {
      covers: ['15.4.1'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/user-agent-may-use-location-field-for-automatic-redirect': {
      covers: ['15.4.1'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/user-agent-may-use-location-header-for-automatic-redirection': {
      covers: ['15.4.8'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/user-agent-may-use-location-header-for-automatic-redirection-for-301-response':
      {
        covers: ['15.4.2'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/user-agent-may-use-location-header-for-automatic-redirection-for-302-response':
      {
        covers: ['15.4.3'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/user-agent-may-use-location-header-for-automatic-redirection-for-308-response':
      {
        covers: ['15.4.9'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/user-agent-must-not-change-request-method-for-automatic-redirection-for-307-response':
      {
        covers: ['15.4.8'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/user-agent-shoud-resend-original-request-with-modifications-for-redirected-requests':
      {
        covers: ['15.4'],
        declared: { types: ['informational'], severity: 'warn' },
      },
    'rfc9110/user-agent-should-display-representation-to-the-user-for-5xx-response':
      {
        covers: ['15.6'],
        declared: { types: ['informational'], severity: 'warn' },
      },
    'rfc9110/user-agent-should-present-error-representation-to-user': {
      covers: ['15.5.2'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/user-agents-should-display-error-representation-to-user': {
      covers: ['15.5'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/client-may-send-upgrade-header': {
      covers: ['7.8'],
      declared: { types: ['analytics'], severity: 'hint' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule's filter (requestHeader('upgrade')) is an HttpFilterExpression; static's own validateHttpTransactions needs a plain predicate function, an incompatible shape.",
        },
        // Likely a mis-declaration, not a real impossibility: sending
        // Upgrade is entirely within Thymian's own control as the client
        // (executability-gate.md's "Probes" section -- a well-formed,
        // spec-permitted message needs no server cooperation), and
        // server-must-send-upgrade-header-in-101-response already declares
        // test for a closely related Upgrade check in this same package.
        // Filed as thymianofficial/thymian-workspace#170 rather than
        // declaring test on a rule this ticket leaves untouched.
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: 'The shared .rule() handler is not yet exercised under test. Likely a mis-declaration rather than a structural impossibility — see thymianofficial/thymian-workspace#170.',
        },
      },
    },
    'rfc9110/client-must-not-use-special-request-target-forms-with-other-methods':
      {
        covers: ['7.1'],
        declared: { types: ['analytics'], severity: 'error' },
        contexts: {
          static: {
            verdict: 'impossible',
            reason: 'not-representable',
            note: 'The assertion inspects the literal request-line target form (asterisk-form, authority-form); the schema models operation paths, not request-line target syntax, so there is nothing here to check against.',
          },
          test: {
            verdict: 'impossible',
            reason: 'condition-not-producible',
            note: "Thymian's own test requests are well-formed per the declared operations; it has no reason to construct an asterisk- or authority-form target on a non-CONNECT/OPTIONS method to misuse in the first place.",
          },
        },
      },
    'rfc9110/client-should-continue-sending-request-when-response-arrives': {
      covers: ['7.5'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/firewall-intermediary-should-not-forward-internal-hosts': {
      covers: ['7.6.3'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/firewall-intermediary-should-replace-internal-hosts-with-pseudonyms':
      {
        covers: ['7.6.3'],
        declared: { types: ['informational'], severity: 'warn' },
      },
    'rfc9110/gateway-may-send-via-header-in-responses': {
      covers: ['7.6.3'],
      declared: { types: ['analytics'], severity: 'hint' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule gates on transaction.response.meta.role === 'gateway' so a gateway's own added Via entry isn't confused with one the origin server already sent.",
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: 'Attributing a response specifically to a gateway (rather than the origin it fronts) needs participant-role metadata that only exists on a captured transaction, never on one direct test exchange.',
        },
      },
    },
    'rfc9110/gateway-must-send-via-header-in-inbound-requests': {
      covers: ['7.6.3'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule gates on transaction.request.meta.role === 'gateway' to scope the requirement to gateway-originated requests specifically.",
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: 'Confirming a request came from a gateway (versus, say, the client itself) needs participant-role metadata only a captured transaction carries; in a direct test exchange Thymian only ever occupies the client role.',
        },
      },
    },
    'rfc9110/intermediary-may-combine-via-entries-with-identical-protocols': {
      covers: ['7.6.3'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/intermediary-must-check-and-update-max-forwards': {
      covers: ['7.6.2'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule compares the Max-Forwards value on an intermediary's inbound leg against its outbound leg (forwardingHops), needing both sides of one forwarding hop at once.",
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: 'Checking that Max-Forwards was decremented across a hop needs the received and forwarded legs together; a single direct test exchange only ever carries one of them.',
        },
      },
    },
    'rfc9110/intermediary-must-generate-updated-max-forwards-when-forwarding': {
      covers: ['7.6.2'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'This rule compares the received and forwarded Max-Forwards values across one hop (forwardingHops), the same correlated-legs shape as the sibling Max-Forwards rules.',
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: 'The decremented value only exists to compare once both the inbound and outbound legs of a hop are available together; a direct test exchange never carries both.',
        },
      },
    },
    'rfc9110/intermediary-must-implement-connection-header': {
      covers: ['7.6'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/intermediary-must-not-forward-message-to-itself': {
      covers: ['7.6'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'Detecting a forwarding loop needs the whole Via chain across a captured trace, checking for a repeated received-by entry -- a property of message history, not of any single message.',
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: 'A direct test exchange has no forwarding history to inspect; Thymian would need to already be positioned as one hop in a multi-hop chain to see whether its own name repeats in the Via chain.',
        },
      },
    },
    'rfc9110/intermediary-must-not-forward-when-max-forwards-is-zero': {
      covers: ['7.6.2'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'This rule infers forwarding occurred from the mere existence of an outbound leg after an inbound Max-Forwards: 0 (forwardingHops) -- a fact about whether a hop happened, not about one message.',
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: 'Whether an intermediary forwarded at all is only visible by comparing an inbound leg against a (missing or present) outbound one; a single direct test exchange is definitionally only one leg.',
        },
      },
    },
    'rfc9110/intermediary-must-parse-and-remove-connection-fields': {
      covers: ['7.6.1'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule compares the Connection header's listed options between an intermediary's inbound and outbound legs (forwardingHops), which validateCapturedHttpTraces exists to correlate.",
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: 'Confirming a hop-by-hop field was actually stripped needs Thymian to observe both the message an intermediary received and the one it forwarded onward -- two correlated legs of a single hop, never present in one direct test exchange.',
        },
      },
    },
    'rfc9110/intermediary-must-respond-as-final-recipient-when-max-forward-is-zero':
      {
        covers: ['7.6.2'],
        declared: { types: ['analytics'], severity: 'error' },
        contexts: {
          static: {
            verdict: 'impossible',
            reason: 'not-representable',
            note: "This rule checks that an intermediary answered directly rather than forwarding, by comparing the inbound leg's Max-Forwards against whether an outbound leg exists (forwardingHops).",
          },
          test: {
            verdict: 'impossible',
            reason: 'participant-not-reachable',
            note: 'Confirming an intermediary became the final recipient needs to see the absence of a forwarded leg, which is only visible against a captured, multi-hop trace, not a single direct exchange.',
          },
        },
      },
    'rfc9110/intermediary-should-remove-known-hop-by-hop-fields': {
      covers: ['7.6.1'],
      declared: { types: ['analytics'], severity: 'warn' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule compares the named hop-by-hop fields (Proxy-Connection, Keep-Alive, TE, Transfer-Encoding, Upgrade) between an intermediary's inbound and outbound legs, which validateCapturedHttpTraces exists to correlate.",
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: 'Confirming a known hop-by-hop field was removed or replaced needs both the received and forwarded legs of one hop at once; a direct test exchange never carries the received leg to compare against.',
        },
      },
    },
    'rfc9110/origin-server-must-reject-https-requests-without-valid-certificate':
      {
        covers: ['7.4'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/origin-server-must-reject-requests-not-meeting-scheme-requirements':
      {
        covers: ['7.4'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/proxy-may-add-domain-to-non-fqdn-hostname': {
      covers: ['7.7'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/proxy-may-transform-content-without-no-transform-directive': {
      covers: ['7.7'],
      declared: { types: ['analytics'], severity: 'hint' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'Detecting a content transformation needs to diff the body a proxy received against the body it forwarded (forwardingHops), two legs of one hop.',
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: 'Telling whether content changed across a hop needs both the inbound and outbound legs at once; a direct test exchange only ever has the one Thymian itself sent and received.',
        },
      },
    },
    'rfc9110/proxy-must-not-change-fqdn-hostname': {
      covers: ['7.7'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule compares the target URI's host between a proxy's inbound and outbound legs (forwardingHops, scoped to the proxy role).",
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: 'Confirming a fully-qualified host survived a hop unchanged needs both the received and forwarded target URIs together; a direct test exchange has no received leg to compare against.',
        },
      },
    },
    'rfc9110/proxy-must-not-modify-absolute-path-and-query': {
      covers: ['7.7'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule compares the absolute-path and query between a proxy's inbound and outbound legs (forwardingHops, scoped to the proxy role).",
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: 'Confirming the path and query survived a hop unchanged needs both legs of the same forwarded request; a direct test exchange only ever carries the one Thymian itself sent.',
        },
      },
    },
    'rfc9110/proxy-must-not-transform-content-with-no-transform-directive': {
      covers: ['7.7'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'This rule compares adjacent captured transactions (prev/curr) gated on the proxy role to detect a content change across a no-transform response.',
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: 'Detecting a forbidden transformation needs two adjacent messages on either side of the same proxy hop; a direct test exchange is only ever one message pair, with no adjacent hop to compare against.',
        },
      },
    },
    'rfc9110/proxy-must-send-via-header': {
      covers: ['7.6.3'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule gates on transaction.request.meta.role === 'proxy' to scope the requirement to proxy-forwarded requests specifically.",
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: "Confirming a request was forwarded by a proxy needs participant-role metadata only a captured transaction carries; a direct test exchange never attributes the sender's role.",
        },
      },
    },
    'rfc9110/proxy-should-not-modify-endpoint-and-representation-headers': {
      covers: ['7.7'],
      declared: { types: ['analytics'], severity: 'warn' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule compares the named representation headers (Content-Type, ETag, Last-Modified, ...) between a proxy's inbound and outbound legs (forwardingHops).",
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: 'Confirming these headers survived a hop unchanged needs both the received and forwarded legs of the same message; a direct test exchange has no received leg from an earlier hop to compare against.',
        },
      },
    },
    'rfc9110/recipient-may-ignore-max-forwards-for-other-methods': {
      covers: ['7.6.2'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/recipient-may-interpret-missing-port-as-default': {
      covers: ['7.6.3'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/recipient-may-remove-comments-before-forwarding': {
      covers: ['7.6.3'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/recipient-should-use-case-insensitive-comparison-for-protocol-names':
      {
        covers: ['7.8'],
        declared: { types: ['informational'], severity: 'warn' },
      },
    'rfc9110/sender-may-generate-comments-to-identify-software': {
      covers: ['7.6.3'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/sender-may-replace-host-with-pseudonym': {
      covers: ['7.6.3'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/sender-must-list-connection-specific-field-in-connection-header': {
      covers: ['7.6.1'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule's filter (or(requestHeader(...), responseHeader(...))) is an HttpFilterExpression, the LiveApiContext form of validateHttpTransactions -- static's own LintContext version of the same method needs a plain predicate function instead, an incompatible shape.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Keep-Alive and Proxy-Connection are connection-management headers a REST API's own declared operations wouldn't include; Thymian's spec-driven test requests have no reason to carry them, so the situation this rule checks never arises to test against.",
        },
      },
    },
    'rfc9110/sender-must-not-combine-via-entries-with-different-protocols': {
      covers: ['7.6.3'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/sender-must-not-send-end-to-end-fields-as-connection-options': {
      covers: ['7.6.1'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule's filter (or(requestHeader('connection'), responseHeader('connection'))) is an HttpFilterExpression; static's own validateHttpTransactions needs a plain predicate function, an incompatible shape.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Misusing Cache-Control or another end-to-end field as a Connection option is a malformed-message scenario a spec-driven test request wouldn't construct; nothing in Thymian's own conformant traffic exercises it.",
        },
      },
    },
    'rfc9110/sender-must-send-upgrade-connection-option': {
      covers: ['7.8'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule's filter (requestHeader('upgrade')) is an HttpFilterExpression; static's own validateHttpTransactions needs a plain predicate function, an incompatible shape.",
        },
        // Likely a mis-declaration, not a real impossibility: same shape as
        // client-may-send-upgrade-header (#170) -- Thymian fully controls
        // whether and how it lists Upgrade in Connection when it sends the
        // header, and server-must-send-upgrade-header-in-101-response
        // already declares test for a closely related check in this same
        // package. Filed as thymianofficial/thymian-workspace#171.
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: 'The shared .rule() handler is not yet exercised under test. Likely a mis-declaration rather than a structural impossibility — see thymianofficial/thymian-workspace#171.',
        },
      },
    },
    'rfc9110/sender-should-not-combine-via-entries-unless-same-organization': {
      covers: ['7.6.3'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/server-may-ignore-client-protocol-preference-order': {
      covers: ['7.8'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/server-may-ignore-upgrade-header': {
      covers: ['7.8'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/server-may-send-upgrade-header-in-other-responses': {
      covers: ['7.8'],
      declared: { types: ['analytics', 'static'], severity: 'hint' },
      contexts: {
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Getting a server to volunteer an Upgrade header on an ordinary (non-101/426) response needs upgrade-advertising behaviour a generic REST API test wouldn't provoke; the mechanism (validateCommonHttpTransactions) is available, the situation isn't producible on demand.",
        },
      },
    },
    'rfc9110/server-must-ignore-upgrade-in-http-1.0-request': {
      covers: ['7.8'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/server-must-list-protocols-in-layer-ascending-order': {
      covers: ['7.8'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/server-must-not-switch-to-non-indicated-protocol': {
      covers: ['7.8'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "The override handler uses validateHttpTransactions with an HttpFilterExpression (and(requestHeader('upgrade'), statusCode(101))); static's own version of the same method needs a plain predicate function instead.",
        },
        // Unlike client-may-send-upgrade-header (#170) and sender-must-
        // send-upgrade-connection-option (#171), this needs the *server*
        // to genuinely agree to switch protocols with an automated test
        // client -- not just Thymian sending a header it fully controls.
        // Thymian's test harness can request an upgrade but cannot compel
        // a real server to complete the handshake on demand, which is what
        // this rule needs to observe (the response side of a real switch).
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: 'Completing a genuine protocol-switch handshake needs the server to agree to switch with an automated test client on demand, which Thymian cannot compel — unlike simply sending an Upgrade request, which Thymian fully controls.',
        },
      },
    },
    'rfc9110/server-must-not-switch-unless-semantics-can-be-honored': {
      covers: ['7.8'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/server-must-send-100-before-101-with-expect-header': {
      covers: ['7.8'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/server-must-send-upgrade-header-in-101-response': {
      covers: ['7.8'],
      declared: { types: ['test', 'analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "101 (Switching Protocols) is an interim response, and interim responses are absent from the static spec projection entirely -- schemas do not model them, per the rule's own comment.",
        },
      },
    },
    'rfc9110/server-must-send-upgrade-header-in-426-response': {
      covers: ['7.8'],
      declared: { types: ['static', 'test', 'analytics'], severity: 'error' },
    },
    'rfc9110/user-agent-must-generate-host-or-authority-header': {
      covers: ['7.2'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule's filter is an HttpFilterExpression built from requestHeader/not combinators; static's own validateHttpTransactions needs a plain predicate function, an incompatible shape.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Thymian's own HTTP client always generates a Host header as a basic transport-level behaviour; the failure this rule checks for can't be produced by Thymian's own conformant outgoing requests.",
        },
      },
    },
    'rfc9110/user-agent-should-send-host-as-first-header': {
      covers: ['7.2'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/accept-ranges-may-be-sent-in-trailer': {
      covers: ['14.3'],
      declared: { types: ['analytics'], severity: 'hint' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule's filter (and(requestHeader(...), not(responseTrailer(...)))) is an HttpFilterExpression passed to validateHttpTransactions; static's own version of that method needs a plain predicate function instead.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Whether a server chooses to place Accept-Ranges in a trailer rather than a header is server-side, optional behaviour a generic test exchange is unlikely to provoke on demand, the same shape as server-may-send-retry-after-header-for-503-response's static gap (#169) but for a live-exchange context instead.",
        },
      },
    },
    'rfc9110/cache-may-use-responses-to-get-for-satisfy-subsequent-get-and-head-requests':
      {
        covers: ['9.3.1'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/cache-may-use-responses-to-head-for-satisfy-subsequent-head-requests':
      {
        covers: ['9.3.2'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/client-may-generate-range-requests-without-accept-ranges': {
      covers: ['14.3'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/client-may-send-max-forwards-header-in-option-request': {
      covers: ['9.3.7'],
      declared: { types: ['analytics'], severity: 'hint' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule's filter (and(method('OPTIONS'), requestHeader('max-forwards'))) is an HttpFilterExpression passed to validateHttpTransactions; static's own version of that method needs a plain predicate function instead.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "The check fires only on a malformed (non-numeric) Max-Forwards value; Thymian's own operation-driven test requests construct well-formed header values, never a deliberately malformed one to trigger this.",
        },
      },
    },
    'rfc9110/client-must-ignore-content-length-or-transfer-encoding-headers-in-response-to-connect':
      {
        covers: ['9.3.6'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/client-must-not-assume-future-range-support-from-accept-ranges': {
      covers: ['14.3'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/client-must-not-generate-fields-containing-sensitive-data-in-trace-request':
      {
        covers: ['9.3.8'],
        declared: { types: ['analytics'], severity: 'error' },
        contexts: {
          static: {
            verdict: 'impossible',
            reason: 'not-representable',
            note: 'Likely a mis-declaration, not a real impossibility: client-must-not-send-content-in-trace-request, in the same directory, already proves TRACE-method operations are representable in static via this same uniform interface — see thymianofficial/thymian-workspace#174.',
          },
          test: {
            verdict: 'impossible',
            reason: 'condition-not-producible',
            note: 'Likely a mis-declaration, not a real impossibility — see thymianofficial/thymian-workspace#174.',
          },
        },
      },
    'rfc9110/client-must-not-send-content-in-trace-request': {
      covers: ['9.3.8'],
      declared: { types: ['static', 'analytics'], severity: 'error' },
      contexts: {
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Whether Thymian's own test-generated TRACE carries a body is determined by the operation's own declared schema, which would not normally document one for TRACE -- the situation this rule checks for is not naturally constructed.",
        },
      },
    },
    'rfc9110/client-must-send-content-type-header-for-content-in-options-request':
      {
        covers: ['9.3.7'],
        declared: { types: ['analytics'], severity: 'error' },
        contexts: {
          static: {
            verdict: 'impossible',
            reason: 'not-representable',
            note: 'Likely a mis-declaration, not a real impossibility: this check is entirely name-level via the uniform validateCommonHttpTransactions interface — see thymianofficial/thymian-workspace#176.',
          },
          test: {
            verdict: 'impossible',
            reason: 'condition-not-producible',
            note: 'Likely a mis-declaration, not a real impossibility — see thymianofficial/thymian-workspace#176.',
          },
        },
      },
    'rfc9110/client-must-send-port-number-for-connect-request': {
      covers: ['9.3.6'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/client-should-list-multiple-ranges-in-ascending-order': {
      covers: ['14.2'],
      declared: { types: ['analytics'], severity: 'warn' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule parses the Range header's list of byte-range-specs and compares each adjacent pair's start position via validateHttpTransactions; static's own version of that method needs a plain predicate function and cannot read or compare pinned values this way.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Triggering this needs a deliberately out-of-order multi-range Range header, which Thymian's operation-driven test requests never construct on their own.",
        },
      },
    },
    'rfc9110/client-should-not-automatically-retry-a-failed-automatic-retry': {
      covers: ['9.2.2'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/client-should-not-automatically-retry-request-with-non-idempotent-method':
      {
        covers: ['9.2.2'],
        declared: { types: ['informational'], severity: 'warn' },
      },
    'rfc9110/client-should-not-generate-content-for-delete-request': {
      covers: ['9.3.5'],
      declared: { types: ['static', 'analytics'], severity: 'warn' },
      contexts: {
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Whether Thymian's own test-generated DELETE carries a body is determined by the operation's own declared schema. Likely a mis-declaration, not a real impossibility — see thymianofficial/thymian-workspace#173.",
        },
      },
    },
    'rfc9110/client-should-not-generate-content-in-get-request': {
      covers: ['9.3.1'],
      declared: { types: ['static', 'analytics'], severity: 'warn' },
      contexts: {
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Whether Thymian's own test-generated GET carries a body is determined by the operation's own declared schema. Likely a mis-declaration, not a real impossibility — see thymianofficial/thymian-workspace#173.",
        },
      },
    },
    'rfc9110/client-should-not-generate-content-in-head-request': {
      covers: ['9.3.2'],
      declared: { types: ['static', 'analytics'], severity: 'warn' },
      contexts: {
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Whether Thymian's own test-generated HEAD carries a body is determined by the operation's own declared schema. Likely a mis-declaration, not a real impossibility — see thymianofficial/thymian-workspace#173.",
        },
      },
    },
    'rfc9110/client-should-not-request-inefficient-multiple-ranges': {
      covers: ['14.2'],
      declared: { types: ['analytics'], severity: 'warn' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule parses the Range header's byte-range-specs, sorts them, and computes the numeric byte gap between adjacent ranges via validateHttpTransactions; static's own version of that method needs a plain predicate function and cannot read or compute values this way.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Triggering this needs a deliberately inefficient multi-range gap in a Range header, which Thymian's operation-driven test requests never construct on their own.",
        },
      },
    },
    'rfc9110/final-recipient-of-trace-request-should-reflect-received-message':
      {
        covers: ['9.3.8'],
        declared: { types: ['informational'], severity: 'warn' },
      },
    'rfc9110/final-recipient-should-exclude-sensitive-request-data-from-response-to-trace':
      {
        covers: ['9.3.8'],
        declared: { types: ['analytics'], severity: 'warn' },
        contexts: {
          static: {
            verdict: 'impossible',
            reason: 'not-representable',
            note: "This rule's own comment states it: the check needs a real sensitive header value actually echoed into a response body, which a schema document has no live exchange to carry.",
          },
          test: {
            verdict: 'impossible',
            reason: 'condition-not-producible',
            note: "This rule's own comment states it: a Thymian-generated test request carries no genuine secret to leak, so the value-echo this rule checks for has nothing real to observe.",
          },
        },
      },
    'rfc9110/general-purpose-servers-must-support-get-and-head': {
      covers: ['9.1'],
      declared: { types: ['test', 'analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'validateCommonHttpTransactions(statusCode(501)) is the same proven static-capable shape 402-status-code-is-reserved/status-code-305/306 already use. Likely a mis-declaration, not a real impossibility — see thymianofficial/thymian-workspace#172.',
        },
      },
    },
    'rfc9110/intermediary-must-attempt-to-send-outstanding-data-coming-from-closed-side-for-connect-request':
      {
        covers: ['9.3.6'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/origin-server-may-accept-connect-request': {
      covers: ['9.3.6'],
      declared: { types: ['test', 'analytics'], severity: 'hint' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'CONNECT is a tunnel-establishment method, not a normal REST operation an OpenAPI/ThymianSchema document models -- there is no operation to check this against.',
        },
      },
    },
    'rfc9110/origin-server-may-redirect-for-existing-resource-for-201-response':
      {
        covers: ['9.3.3'],
        declared: { types: ['static', 'analytics', 'test'], severity: 'hint' },
      },
    'rfc9110/origin-server-must-disable-safe-methods-for-unsafe-resources': {
      covers: ['9.2.1'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/origin-server-must-ignore-range-header-with-unknown-range-unit': {
      covers: ['14.2'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/origin-server-must-not-sent-validator-field-in-response-to-put-request':
      {
        covers: ['9.3.4'],
        declared: { types: ['static', 'analytics', 'test'], severity: 'error' },
      },
    'rfc9110/origin-server-must-respond-with-correct-response-code-for-put-request':
      {
        covers: ['9.3.4'],
        declared: { types: ['static', 'analytics', 'test'], severity: 'error' },
      },
    'rfc9110/origin-server-must-send-3xx-response-if-state-change-should-be-applied-to-other-resource':
      {
        covers: ['9.3.4'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/origin-server-should-ingore-unrecognized-header-and-trailer-fields-received-in-put-request':
      {
        covers: ['9.3.4'],
        declared: { types: ['informational'], severity: 'warn' },
      },
    'rfc9110/origin-server-should-not-rely-on-private-agreements': {
      covers: ['9.3.1'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/origin-server-should-not-rely-on-private-agreements-for-head-requests':
      {
        covers: ['9.3.2'],
        declared: { types: ['informational'], severity: 'warn' },
      },
    'rfc9110/origin-server-should-not-rely-on-private-agreements-to-receive-content-in-delete-request':
      {
        covers: ['9.3.5'],
        declared: { types: ['informational'], severity: 'warn' },
      },
    'rfc9110/origin-server-should-response-with-409-or-415-status-code-to-put-request-for-inconsistent-representation':
      {
        covers: ['9.3.4'],
        declared: { types: ['informational'], severity: 'warn' },
      },
    'rfc9110/origin-server-should-send-400-for-unsupported-partial-put': {
      covers: ['14.5'],
      declared: { types: ['static', 'test'], severity: 'warn' },
      contexts: {
        analytics: {
          verdict: 'impossible',
          reason: 'requires-controlled-input',
          note: 'Whether this SHOULD applies depends on a precondition -- the resource genuinely not supporting partial PUT -- that recorded traffic alone cannot establish; passively-observed traffic shows what happened, not whether the precondition held.',
        },
      },
    },
    'rfc9110/origin-server-should-send-405-response-for-unallowed-method': {
      covers: ['9.1'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/origin-server-should-send-501-response-for-unrecognized-method': {
      covers: ['9.1'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/origin-server-should-send-correct-successful-status-code-to-delete-request':
      {
        covers: ['9.3.5'],
        declared: { types: ['static', 'analytics', 'test'], severity: 'warn' },
      },
    'rfc9110/origin-server-should-send-location-header-for-201-response': {
      covers: ['9.3.3'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'warn' },
    },
    'rfc9110/origin-server-should-verify-constraints-for-target-resource-for-put-request':
      {
        covers: ['9.3.4'],
        declared: { types: ['informational'], severity: 'warn' },
      },
    'rfc9110/other-methods-than-get-and-head-are-optional': {
      covers: ['9.1'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/proxy-may-discard-range-header-with-unknown-range-unit': {
      covers: ['14.2'],
      declared: { types: ['analytics'], severity: 'hint' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule's filter (requestHeader('range')) is an HttpFilterExpression passed to validateHttpTransactions; static's own version of that method needs a plain predicate function instead.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: 'Likely a mis-declaration, not a real impossibility — see thymianofficial/thymian-workspace#175.',
        },
      },
    },
    'rfc9110/proxy-must-not-automatically-retry-non-idempontent-requests': {
      covers: ['9.2.2'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/proxy-must-not-generate-new-max-forwards-header': {
      covers: ['9.3.7'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule's own comment states it: the MUST NOT is only observable by correlating a proxy's received and forwarded legs of the same hop, which a schema document has no concept of.",
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: "This rule's own comment states it: it needs real cross-hop information (the received-versus-forwarded Max-Forwards value across one proxy hop), which a direct test exchange never carries.",
        },
      },
    },
    'rfc9110/proxy-should-forward-206-with-unknown-range-unit': {
      covers: ['14.4'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/recipient-must-anticipate-large-decimal-numerals-for-byte-range': {
      covers: ['14.1.2'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule parses the Range header's first-pos/last-pos/suffix-length numerals and BigInt-compares each against Number.MAX_SAFE_INTEGER via validateHttpTransactions; static's own version of that method needs a plain predicate function and cannot read or compare pinned values this way.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Likely a mis-declaration, not a real structural impossibility: origin-server-should-send-400-for-unsupported-partial-put and server-should-send-206-response-for-satisfiable-range, in the same package, already prove a probe can pin an arbitrary Range value via replayStep().set(requestHeader('range'), constant(...)). But this rule's own check only inspects the request it is handed, never the resulting response, so a test probe would trivially flag its own overflow-scale input every time regardless of how the target actually behaves -- the check itself would need to read the response for parsing failure evidence before test executability would mean anything. That is a rule-body change, not a declared-type omission -- see thymianofficial/thymian-workspace#177.",
        },
      },
    },
    'rfc9110/recipient-must-not-recombine-206-with-unknown-range-unit': {
      covers: ['14.4'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/recipient-must-not-recombine-invalid-content-range': {
      covers: ['14.4'],
      declared: { types: ['analytics', 'test'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule parses the Content-Range value's first-pos/last-pos/complete-length components and numerically compares them (last-pos < first-pos, or complete-length <= last-pos) via validateHttpTransactions; static's own version of that method needs a plain predicate function and cannot read or compare pinned values this way.",
        },
      },
    },
    'rfc9110/sender-should-indicate-complete-length-for-byte-ranges': {
      covers: ['14.4'],
      declared: { types: ['analytics', 'test'], severity: 'warn' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule reads and parses the real Content-Range complete-length component via validateHttpTransactions; static's own version of that method needs a plain predicate function and cannot read a pinned value this way.",
        },
      },
    },
    'rfc9110/server-may-ignore-or-reject-invalid-range-header': {
      covers: ['14.2'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/server-may-ignore-range-header': {
      covers: ['14.2'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/server-may-ignore-range-header-for-zero-length-representation': {
      covers: ['14.2'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/server-may-omit-header-fields-for-head-response': {
      covers: ['9.3.2'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/server-may-send-accept-ranges-none': {
      covers: ['14.3'],
      declared: { types: ['analytics'], severity: 'hint' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule's filter (responseHeader('accept-ranges')) is passed to validateHttpTransactions with a value-reading handler; static's own version of that method needs a plain predicate function and cannot read a pinned value this way.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Whether a server opts out of range support with 'Accept-Ranges: none' is server-side, optional behaviour a generic test exchange is unlikely to provoke on demand.",
        },
      },
    },
    'rfc9110/server-must-ignore-content-range-for-unsupported-method': {
      covers: ['14.4'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/server-must-ignore-range-header-for-unrecognized-method': {
      covers: ['14.2'],
      declared: { types: ['static', 'analytics'], severity: 'error' },
      contexts: {
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Likely a mis-declaration, not a real impossibility: the check already runs on the common request/response projection (method + status/Content-Range), and server-should-send-206-response-for-satisfiable-range, in the same package, already proves a probe can replay an existing transaction with an added Range header via replayStep().set(requestHeader('range'), constant(...)). The same technique -- replaying a non-GET transaction with an added Range header and reusing this rule's own response check -- would make this observable in test without any rule-body change. See thymianofficial/thymian-workspace#178.",
        },
      },
    },
    'rfc9110/server-must-not-send-content-in-response-to-head': {
      covers: ['9.3.2'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'error' },
    },
    'rfc9110/server-must-not-send-transfer-encoding-or-content-length-headers-in-2xx-response-to-connect-request':
      {
        covers: ['9.3.6'],
        declared: { types: ['static', 'analytics'], severity: 'error' },
        contexts: {
          test: {
            verdict: 'impossible',
            reason: 'condition-not-producible',
            note: "CONNECT is not a REST operation a declared API spec would include, so Thymian's spec-driven test requests have no occasion to send one.",
          },
        },
      },
    'rfc9110/server-must-reject-connect-request-with-empty-or-invalid-port-number':
      {
        covers: ['9.3.6'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/server-should-send-206-response-for-satisfiable-range': {
      covers: ['14.2'],
      declared: { types: ['test'], severity: 'warn' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule's mechanism is an active singleTestCase probe that constructs and verifies a live satisfiable-range exchange; a schema document has no equivalent live check to run.",
        },
        analytics: {
          verdict: 'impossible',
          reason: 'requires-controlled-input',
          note: "Whether the SHOULD's precondition held -- a genuinely satisfiable range against the resource's real state -- cannot be established from passively recorded traffic alone.",
        },
      },
    },
    'rfc9110/server-should-send-416-response-for-unsatisfiable-range': {
      covers: ['14.2'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/server-should-send-content-range-in-416-response': {
      covers: ['14.4'],
      declared: { types: ['analytics', 'test'], severity: 'warn' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule's own comment states it: the 416 clause needs the specific 'bytes */complete-length' value shape, which the common (name-only) projection cannot see, and static's own validateHttpTransactions needs a plain predicate function rather than the HttpFilterExpression this rule builds.",
        },
      },
    },
    'rfc9110/server-should-send-headers-indicating-optional-features-in-2xx-response-to-options-request':
      {
        covers: ['9.3.7'],
        declared: { types: ['static', 'analytics', 'test'], severity: 'warn' },
      },
    'rfc9110/server-should-send-same-header-fields-in-response-to-head': {
      covers: ['9.3.2'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'warn' },
    },
    'rfc9110/service-that-selects-uri-for-client-should-use-post-instead-of-put':
      {
        covers: ['9.3.4'],
        declared: { types: ['informational'], severity: 'warn' },
      },
    'rfc9110/user-agent-distinguish-between-safe-and-unsafe-methods': {
      covers: ['9.2.1'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/user-agent-may-make-own-decision-to-redirect-request-for-3xx-response-to-put-request':
      {
        covers: ['9.3.4'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/non-origin-server-must-not-evaluate-conditional-headers': {
      covers: ['13.2.1'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/server-must-evaluate-preconditions-after-normal-checks': {
      covers: ['13.2.1'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/server-must-evaluate-preconditions-in-correct-order': {
      covers: ['13.2.2'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/server-must-ignore-conditionals-for-connect-options-trace': {
      covers: ['13.2.1'],
      declared: { types: ['static', 'analytics'], severity: 'error' },
      contexts: {
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Likely a mis-declaration for the OPTIONS branch of this check, not a full impossibility: the check already runs on the common request/response projection (method + conditional-header names + status), and server-must-ignore-range-header-for-unrecognized-method, in this package's range-requests batch, already proves a probe can replay an existing transaction with an added header via replayStep().set(...) and reuse a common-interface check unchanged. CONNECT and TRACE stay out of reach (not REST operations a declared API spec would include), but OPTIONS commonly is -- see thymianofficial/thymian-workspace#179.",
        },
      },
    },
    'rfc9110/server-must-ignore-preconditions-for-non-2xx-412-responses': {
      covers: ['13.2.1'],
      declared: { types: ['test'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "The whole mechanism is ctx.httpTest(singleTestCase()...), TestContext-only; the assertion is a counterfactual (what would THIS request's status be without its preconditions), which a schema document has no way to encode -- there is no declared-response concept of 'the same operation, evaluated without its conditional headers'.",
        },
        analytics: {
          verdict: 'impossible',
          reason: 'requires-controlled-input',
          note: 'Deciding this needs the counterfactual unconditioned response, which only an active replay (add a guaranteed-failing If-Match to a request already known to answer non-2xx/non-412) can establish; recorded traffic never carries both the original and the replayed pair for the same request.',
        },
      },
    },
    'rfc9110/cache-or-intermediary-may-ignore-if-match': {
      covers: ['13.1.1'],
      declared: { types: ['analytics'], severity: 'hint' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "The filter (requestHeader('if-match')) is an HttpFilterExpression passed to validateHttpTransactions; static's own version of that method needs a plain predicate function instead, a type-level incompatibility independent of any document.",
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: "appliesTo is scoped to cache/intermediary roles; Thymian's test client always plays the client role talking directly to the target, never a middlebox relaying someone else's request, so it cannot be positioned to observe what a cache or intermediary chose to do with the header.",
        },
      },
    },
    'rfc9110/client-may-send-if-match-header': {
      covers: ['13.1.1'],
      declared: { types: ['analytics'], severity: 'hint' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "Likely a mis-declaration, not a real impossibility: client-may-send-if-unmodified-since-header, in the same directory, already declares static for the identical and(method('GET'), not(requestHeader(...))) shape via validateCommonHttpTransactions -- direct proof this filter is static-representable. See thymianofficial/thymian-workspace#180.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Likely a mis-declaration, not a real impossibility: this is a MAY, and the gate doc's own test for a MAY is whether Thymian would see a difference in the messages available to it if the actor exercised or declined the permission -- which it would, inside Thymian's own generated request. See thymianofficial/thymian-workspace#180.",
        },
      },
    },
    'rfc9110/origin-server-may-respond-with-2xx-response-even-condition-failed':
      {
        covers: ['13.1.1'],
        declared: { types: ['test', 'static', 'analytics'], severity: 'hint' },
      },
    'rfc9110/origin-server-may-respond-with-412-response-to-conditional-request':
      {
        covers: ['13.1.1'],
        declared: { types: ['static', 'test'], severity: 'hint' },
        contexts: {
          analytics: {
            verdict: 'impossible',
            reason: 'requires-controlled-input',
            note: "The shared rule() flags any If-Match request that didn't get 412, but whether 412 was actually available to send depends on the condition genuinely evaluating false (a real ETag mismatch); recorded traffic can't distinguish a request the server correctly let through (condition true) from one where it legitimately chose 2xx over 412, without knowing the resource's real validator history.",
          },
        },
      },
    'rfc9110/origin-server-must-evaluate-if-match-before-method': {
      covers: ['13.1.1'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/origin-server-must-not-perform-method-when-if-match-fails': {
      covers: ['13.1.1'],
      declared: { types: ['test'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'The whole mechanism is a sender-driven active probe (force a non-matching If-Match via singleTestCase, TestContext-only); a schema document has no counterfactual-failure concept to check against.',
        },
        analytics: {
          verdict: 'impossible',
          reason: 'requires-controlled-input',
          note: "Telling a genuine If-Match failure (real ETag mismatch) from ordinary traffic needs knowing the resource's actual current validator, which passive recorded traffic doesn't carry; only a controlled probe (deliberately mismatched If-Match) can force and observe the failure path.",
        },
      },
    },
    'rfc9110/origin-server-must-use-strong-comparison-for-if-match': {
      covers: ['13.1.1'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/origin-server-should-evaluate-if-modified-since': {
      covers: ['13.1.3'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/origin-server-should-respond-304-when-if-modified-since-false': {
      covers: ['13.1.3'],
      declared: { types: ['static', 'test'], severity: 'warn' },
      contexts: {
        analytics: {
          verdict: 'impossible',
          reason: 'requires-controlled-input',
          note: "The shared rule() flags any If-Modified-Since request that didn't get 304, but most real conditional GETs correctly get 200 because the resource genuinely changed; recorded traffic can't tell that legitimate case from a server wrongly skipping 304, without knowing whether the condition should have evaluated false.",
        },
      },
    },
    'rfc9110/recipient-must-ignore-if-modified-since-for-non-get-head': {
      covers: ['13.1.3'],
      declared: { types: ['static', 'analytics'], severity: 'error' },
      contexts: {
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Likely a mis-declaration, not a full impossibility: the check already runs on the common projection (method + header name + status), and server-must-ignore-range-header-for-unrecognized-method, in this package's range-requests batch, already proves a probe can replay an existing transaction with an added header and reuse a common-interface check unchanged -- the same technique applies here (replay a non-GET/HEAD transaction with an added If-Modified-Since header). See thymianofficial/thymian-workspace#179.",
        },
      },
    },
    'rfc9110/recipient-must-ignore-if-modified-since-header-if-no-date-available':
      {
        covers: ['13.1.3'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/recipient-must-ignore-if-modified-since-when-if-none-match-present':
      {
        covers: ['13.1.3'],
        declared: { types: ['static', 'test'], severity: 'error' },
        contexts: {
          analytics: {
            verdict: 'impossible',
            reason: 'requires-controlled-input',
            note: "The shared rule() flags mere co-occurrence of If-None-Match and If-Modified-Since, which RFC 9110 explicitly permits for backward compatibility; telling a conformant co-occurrence from a recipient that wrongly let the date override the tag needs the counterfactual (what If-None-Match alone would have produced), which passive traffic doesn't carry.",
          },
        },
      },
    'rfc9110/recipient-must-interpret-if-modified-since-value-in-terms-of-servers-clock':
      {
        covers: ['13.1.3'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/client-should-generate-if-none-match-for-cache-updates': {
      covers: ['13.1.2'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/origin-server-must-evaluate-if-none-match-before-method': {
      covers: ['13.1.2'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/origin-server-must-respond-304-or-412-when-if-none-match-fails': {
      covers: ['13.1.2'],
      declared: { types: ['static', 'test'], severity: 'error' },
      contexts: {
        analytics: {
          verdict: 'impossible',
          reason: 'requires-controlled-input',
          note: "The shared rule() flags any If-None-Match request that didn't get 304/412 on the expected method split, but whether the condition genuinely evaluated false (a real ETag match) is server-side state recorded traffic can't establish without the counterfactual.",
        },
      },
    },
    'rfc9110/recipient-must-use-weak-comparison-for-if-none-match': {
      covers: ['13.1.2'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/client-must-not-generate-if-range-header-containing-http-date': {
      covers: ['13.1.5'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'Likely a mis-declaration, not a real impossibility: this is a single-header value-shape check (does If-Range look like an entity-tag rather than an HTTP-date), exactly the case the gate doc\'s own named trap covers -- "the specification does not pin the value" is not a valid impossibility reason, and .overrideStaticRule() reading a schema-pinned If-Range pattern/example is the documented way to make this static-representable, with a runtime rule-skip fallback when the schema does not pin one. See thymianofficial/thymian-workspace#183.',
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "This is a client MUST-NOT about what Thymian itself sends; forcing a non-conformant If-Range value would only prove Thymian's own deliberately-malformed probe was malformed, telling us nothing about the target, and there is no schema mechanism by which an If-Range example would naturally arrive in this specific invalid shape.",
        },
      },
    },
    'rfc9110/client-must-not-generate-if-range-with-weak-etag': {
      covers: ['13.1.5'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'Same shape as client-must-not-generate-if-range-header-containing-http-date: a single-header value-shape check (the weak W/ prefix) that .overrideStaticRule() could read from a schema-pinned pattern -- see thymianofficial/thymian-workspace#183.',
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Same reasoning as client-must-not-generate-if-range-header-containing-http-date: a deliberately-injected weak ETag would only test Thymian's own probe construction, not the target, and nothing in ordinary schema-driven generation would produce a weak validator here on its own.",
        },
      },
    },
    'rfc9110/client-must-not-generate-if-range-without-range': {
      covers: ['13.1.5'],
      declared: { types: ['static', 'analytics'], severity: 'error' },
      contexts: {
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Whether Thymian's schema-driven generator includes If-Range without also including Range on the same request depends on how it samples independent optional header parameters, which this package has no visibility into or established precedent for; unlike a single boolean schema property (e.g. a declared request body), this is a two-header correlation this batch found no concrete mechanism to trigger deliberately without the same vacuous self-construction problem a forced probe would have.",
        },
      },
    },
    'rfc9110/origin-server-must-ignore-if-range-header-if-target-resource-does-not-support-range-requests':
      {
        covers: ['13.1.5'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/recipient-must-ignore-range-when-if-range-false': {
      covers: ['13.1.5'],
      declared: { types: ['test'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'The whole mechanism is a sender-driven active probe (force If-Range false via singleTestCase, TestContext-only); a schema document has no counterfactual-condition concept to check against.',
        },
        analytics: {
          verdict: 'impossible',
          reason: 'requires-controlled-input',
          note: "Telling a genuinely false If-Range condition (real validator mismatch) from ordinary range traffic needs knowing the resource's actual current validator, which passive recorded traffic doesn't carry; only a controlled probe can force and observe the false-condition path.",
        },
      },
    },
    'rfc9110/recipient-should-process-range-header-if-if-range-matches': {
      covers: ['13.1.5'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/server-must-evaluate-if-range': {
      covers: ['13.1.5'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/server-must-ignore-if-range-without-range': {
      covers: ['13.1.5'],
      declared: { types: ['static', 'test', 'analytics'], severity: 'error' },
    },
    'rfc9110/cache-or-intermediary-may-ignore-if-unmodified-since': {
      covers: ['13.1.1'],
      declared: { types: ['analytics'], severity: 'hint' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "Same shape as cache-or-intermediary-may-ignore-if-match: the bare-presence filter is an HttpFilterExpression passed to validateHttpTransactions, incompatible with static's own plain-predicate signature.",
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: "Same shape as cache-or-intermediary-may-ignore-if-match: appliesTo is scoped to cache/intermediary roles, and Thymian's test client always plays the client role, never a middlebox.",
        },
      },
    },
    'rfc9110/client-may-send-if-unmodified-since-header': {
      covers: ['13.1.1'],
      declared: { types: ['static', 'analytics'], severity: 'hint' },
      contexts: {
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Likely a mis-declaration, not a real impossibility: this is a MAY, and the gate doc's own test for a MAY is whether Thymian would see a difference in the messages available to it if the actor exercised or declined the permission -- which it would, inside Thymian's own generated request, the same reasoning as its sibling client-may-send-if-match-header. See thymianofficial/thymian-workspace#180.",
        },
      },
    },
    'rfc9110/origin-server-may-respond-with-2xx-response-even-condition-failed-for-unmodified-since':
      {
        covers: ['13.1.1'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/origin-server-may-respond-with-412-response-to-unmodified-since': {
      covers: ['13.1.4'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/origin-server-must-evaluate-if-unmodified-since': {
      covers: ['13.1.4'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/origin-server-must-not-perform-method-when-if-unmodified-since-fails':
      {
        covers: ['13.1.4'],
        declared: { types: ['test'], severity: 'error' },
        contexts: {
          static: {
            verdict: 'impossible',
            reason: 'not-representable',
            note: "The whole mechanism is a sender-driven active probe (force If-Unmodified-Since 10 seconds before the resource's own Last-Modified via singleTestCase, TestContext-only); a schema document has no counterfactual-failure concept to check against.",
          },
          analytics: {
            verdict: 'impossible',
            reason: 'requires-controlled-input',
            note: "Telling a genuine If-Unmodified-Since failure (the resource really was modified after the given instant) from ordinary traffic needs the resource's real modification history, which passive recorded traffic doesn't carry; only a controlled probe can force and observe the failure path.",
          },
        },
      },
    'rfc9110/recipient-must-ignore-if-unmodified-since-header-if-no-date-available':
      {
        covers: ['13.1.4'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/recipient-must-ignore-if-unmodified-since-when-if-match-present': {
      covers: ['13.1.4'],
      declared: { types: ['test'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'The whole mechanism is an active probe correlating two forced header values against one response (singleTestCase, TestContext-only); a schema document has no counterfactual-precedence concept to check against.',
        },
        analytics: {
          verdict: 'impossible',
          reason: 'requires-controlled-input',
          note: "Telling a recipient that correctly ignored If-Unmodified-Since from one that coincidentally got the same status for another reason needs the counterfactual (what If-Match alone would have produced), which passive traffic doesn't carry.",
        },
      },
    },
    'rfc9110/recipient-must-interpret-if-unmodified-since-value-in-terms-of-servers-clock':
      {
        covers: ['13.1.4'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/automated-client-must-log-error-to-audit-log-for-bad-certificate':
      {
        covers: ['4.3.4'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/automated-client-should-terminate-connection-for-bad-certificate':
      {
        covers: ['4.3.4'],
        declared: { types: ['informational'], severity: 'warn' },
      },
    'rfc9110/automated-clients-may-provide-setting-to-disable-certificate-check':
      {
        covers: ['4.3.4'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/automated-clients-must-provide-setting-to-enable-certificate-check':
      {
        covers: ['4.3.4'],
        declared: { types: ['informational'], severity: 'error' },
      },
    'rfc9110/client-may-access-by-resolving-host-to-ip-address': {
      covers: ['4.3.2'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/client-must-construct-reference-identity': {
      covers: ['4.3.4'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/client-must-not-use-cn-id-reference-identity': {
      covers: ['4.3.4'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/client-must-use-rfc6125-verification': {
      covers: ['4.3.4'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/client-must-verify-service-identity': {
      covers: ['4.3.4'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/user-agent-must-handle-bad-certificate': {
      covers: ['4.3.4'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/recipient-must-reject-http-uri-without-host': {
      covers: ['4.2.1'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule parses the real request-target URI via validateHttpTransactions to check for an empty host component; static's own version of validateHttpTransactions needs a plain predicate function and cannot read or parse a pinned target this way.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Thymian's client needs a resolvable host to open the underlying TCP/TLS connection at all; unlike a header value or even an unusually long path, an origin overridden to a genuinely empty host (via the origin() template field replayStep().set() already supports) leaves nothing for the transport layer to connect to -- a transport-level constraint, not a gap in this corpus's probe techniques.",
        },
      },
    },
    'rfc9110/sender-must-not-generate-http-uri-with-empty-host': {
      covers: ['4.2.1'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule parses the real request-target URI via validateHttpTransactions to check for an empty host component; static's own version of validateHttpTransactions needs a plain predicate function and cannot read or parse a pinned target this way.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Thymian's client needs a resolvable host to open the underlying TCP/TLS connection at all; unlike a header value or even an unusually long path, an origin overridden to a genuinely empty host (via the origin() template field replayStep().set() already supports) leaves nothing for the transport layer to connect to -- a transport-level constraint, not a gap in this corpus's probe techniques.",
        },
      },
    },
    'rfc9110/client-must-secure-https-requests-and-responses': {
      covers: ['4.2.2'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/recipient-must-reject-https-uri-without-host': {
      covers: ['4.2.2'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule parses the real request-target URI via validateHttpTransactions to check for an empty host component; static's own version of validateHttpTransactions needs a plain predicate function and cannot read or parse a pinned target this way.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Thymian's client needs a resolvable host to open the underlying TCP/TLS connection at all; unlike a header value or even an unusually long path, an origin overridden to a genuinely empty host (via the origin() template field replayStep().set() already supports) leaves nothing for the transport layer to connect to -- a transport-level constraint, not a gap in this corpus's probe techniques.",
        },
      },
    },
    'rfc9110/sender-must-not-generate-https-uri-with-empty-host': {
      covers: ['4.2.2'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule parses the real request-target URI via validateHttpTransactions to check for an empty host component; static's own version of validateHttpTransactions needs a plain predicate function and cannot read or parse a pinned target this way.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Thymian's client needs a resolvable host to open the underlying TCP/TLS connection at all; unlike a header value or even an unusually long path, an origin overridden to a genuinely empty host (via the origin() template field replayStep().set() already supports) leaves nothing for the transport layer to connect to -- a transport-level constraint, not a gap in this corpus's probe techniques.",
        },
      },
    },
    'rfc9110/authority-should-not-use-equivalent-uris-for-distinct-resources': {
      covers: ['4.2.3'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/http-component-may-perform-normalization': {
      covers: ['4.2.3'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/sender-recipient-should-support-8000-octet-uris': {
      covers: ['4.1'],
      declared: { types: ['analytics'], severity: 'warn' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule measures the real serialized URI's byte length via validateHttpTransactions; static's own version needs a plain predicate function and, even with an override, a schema's pattern/enum/const constraints describe a value's shape, not the emitted length of whatever URI a live request happens to carry.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Likely a mis-declaration, not a real impossibility: path() is a real RequestFilterExpression (packages/core/src/http-filter.ts), and overrideTemplate has a working case 'path' branch, so replayStep().set(path(), constant(<a long path>)).run() can extend an existing transaction's path well past 8000 octets -- a well-formed, spec-permitted message, unlike an empty host or userinfo-bearing authority. See thymianofficial/thymian-workspace#182.",
        },
      },
    },
    'rfc9110/recipient-should-treat-userinfo-in-uri-from-untrusted-source-as-error':
      {
        covers: ['4.2.4'],
        declared: { types: ['analytics'], severity: 'warn' },
        contexts: {
          static: {
            verdict: 'impossible',
            reason: 'not-representable',
            note: 'Likely a mis-declaration, not a real impossibility: sender-must-not-generate-userinfo-in-uri, in the same directory, already proves this exact value-reading check (parse the target URI, test url.username/url.password) is static-representable when written against validateCommonHttpTransactions instead of validateHttpTransactions -- this rule uses the latter today, which is why static is currently blocked. See thymianofficial/thymian-workspace#181.',
          },
          test: {
            verdict: 'impossible',
            reason: 'condition-not-producible',
            note: "replayStep().set(origin(), ...) can mutate the request-target's host/port, but HttpRequestTemplate.origin is documented to normalize userinfo away when the actual request is built from it (packages/core/src/http.ts: HttpRequest.target's own comment contrasts it against 'origin', which 'normalizes away' subcomponents like userinfo) -- so unlike a long path, a userinfo-bearing origin set through this mechanism would not survive into the request actually sent.",
          },
        },
      },
    'rfc9110/sender-must-not-generate-userinfo-in-uri': {
      covers: ['4.2.4'],
      declared: { types: ['static', 'analytics'], severity: 'error' },
      contexts: {
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Same transport constraint as its sibling recipient-should-treat-userinfo-in-uri-from-untrusted-source-as-error: origin() mutation exists but HttpRequestTemplate.origin normalizes userinfo away before a request is actually sent. This is also a client MUST-NOT about Thymian's own output, so even setting it through a lower-level path would only prove Thymian's own deliberate malformation, not test the target.",
        },
      },
    },
    'rfc9110/origin-server-should-send-401-for-invalid-credentials': {
      covers: ['11.4'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/proxy-should-send-407-for-invalid-proxy-credentials': {
      covers: ['11.4'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/proxy-must-not-modify-authentication-info': {
      covers: [],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule's whole mechanism is validateCapturedHttpTraces, comparing the Authentication-Info value across a proxy's inbound and outbound hop; that method is declared only on AnalyzeContext (packages/core/src/rules/contexts.ts), structurally absent from LintContext.",
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: "This rule is scoped to the proxy role (appliesTo('proxy')); Thymian's test client always plays the client role, never an intermediary hop, so it cannot be positioned to capture both sides of a proxy's forwarding decision -- the reason validateCapturedHttpTraces has no TestContext counterpart in the first place, not a separate blocker alongside it.",
        },
      },
    },
    'rfc9110/proxy-must-not-modify-authorization': {
      covers: ['11.6.2'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule's whole mechanism is validateCapturedHttpTraces, comparing the Authorization value across a proxy's inbound and outbound hop; that method is declared only on AnalyzeContext (packages/core/src/rules/contexts.ts), structurally absent from LintContext.",
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: "This rule is scoped to the proxy role (appliesTo('proxy')); Thymian's test client always plays the client role, never an intermediary hop, so it cannot be positioned to capture both sides of a proxy's forwarding decision -- the reason validateCapturedHttpTraces has no TestContext counterpart in the first place, not a separate blocker alongside it.",
        },
      },
    },
    'rfc9110/proxy-must-not-modify-www-authenticate': {
      covers: ['11.6.1'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule's whole mechanism is validateCapturedHttpTraces, comparing the WWW-Authenticate value across a proxy's inbound and outbound hop; that method is declared only on AnalyzeContext (packages/core/src/rules/contexts.ts), structurally absent from LintContext.",
        },
        test: {
          verdict: 'impossible',
          reason: 'participant-not-reachable',
          note: "This rule is scoped to the proxy role (appliesTo('proxy')); Thymian's test client always plays the client role, never an intermediary hop, so it cannot be positioned to capture both sides of a proxy's forwarding decision -- the reason validateCapturedHttpTraces has no TestContext counterpart in the first place, not a separate blocker alongside it.",
        },
      },
    },
    'rfc9110/server-may-send-www-authenticate-in-other-responses': {
      covers: ['11.6.1'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'hint' },
    },
    'rfc9110/authentication-parameter-name-must-occur-once-per-challenge': {
      covers: ['11.2'],
      declared: { types: ['test', 'analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "The whole mechanism is entirely overrideTest()/overrideAnalyticsRule() (no shared .rule()); the check parses a full auth-param challenge/credential list and detects a repeated parameter NAME across it, a structured-grammar parse plus a uniqueness computation -- not a single pinned value's shape a schema's pattern/enum/const could express.",
        },
      },
    },
    'rfc9110/authentication-scheme-must-accept-token-and-quoted-string': {
      covers: ['11.2'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/proxy-authenticate-applies-to-next-client': {
      covers: ['11.7.1'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/proxy-may-relay-credentials': {
      covers: ['11.7.2'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/realm-parameter-must-use-quoted-string-syntax': {
      covers: ['11.5'],
      declared: { types: ['test', 'analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "Same shape as authentication-parameter-name-must-occur-once-per-challenge: locating the specific realm parameter within a parsed, multi-parameter auth-param list and checking its own quoting style is a structured-grammar parse, not a single pinned value's shape.",
        },
      },
    },
    'rfc9110/user-agent-may-reuse-same-credentials-for-identical-protection-space':
      {
        covers: ['11.5'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/client-must-retain-knowledge-of-request': {
      covers: ['6'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/client-may-send-lower-version-for-broken-servers': {
      covers: ['6.2'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/client-must-not-send-non-conformant-version': {
      covers: ['6.2'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/client-should-send-highest-conformant-version': {
      covers: ['6.2'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/recipient-should-process-higher-minor-version-as-highest-known': {
      covers: ['6.2'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/server-must-not-send-non-conformant-version': {
      covers: ['6.2'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/server-should-send-response-version-equal-to-highest-conformant': {
      covers: ['6.2'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/each-http-version-defines-own-framing': {
      covers: ['6'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/implicit-framing-allowed-for-backwards-compatibility': {
      covers: ['6'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/message-complete-when-framed-octets-available': {
      covers: ['6'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/header-field-term-for-header-section-only-fields': {
      covers: ['6'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/header-fields-sent-before-content': {
      covers: ['6'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/header-section-consists-of-field-lines': {
      covers: ['6'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/origin-server-may-generate-date-for-1xx-5xx': {
      covers: ['6.6.1'],
      declared: { types: ['analytics'], severity: 'hint' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule's filter is passed to validateHttpTransactions (non-Common); static's own version of that method needs a plain predicate function and cannot accept an HttpFilterExpression this way.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Eliciting a genuine 1xx (interim) or 5xx (server error) response on demand needs provoking an actual protocol-upgrade sequence or server-side failure condition, which Thymian's operation-driven test requests don't naturally produce.",
        },
      },
    },
    'rfc9110/origin-server-with-clock-must-generate-date-for-2xx-3xx-4xx': {
      covers: ['6.6.1'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'error' },
    },
    'rfc9110/origin-server-without-clock-must-not-generate-date': {
      covers: ['6.6.1'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/recipient-may-replace-invalid-date': {
      covers: ['6.6.1'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/recipient-with-clock-must-add-date-if-missing': {
      covers: ['6.6.1'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/sender-should-generate-date-at-message-generation': {
      covers: ['6.6.1'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/user-agent-may-send-date-header-in-request': {
      covers: ['6.6.1'],
      declared: { types: ['analytics'], severity: 'hint' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "Likely a mis-declaration, not a real impossibility: this is a bare-presence filter (not(requestHeader('date'))) with no value-reading dependency, currently passed to the non-Common validateHttpTransactions; switching to validateCommonHttpTransactions -- as this rule's own sibling user-agent-should-not-send-from-without-configuration already does for the identical shape -- would remove the type incompatibility. See thymianofficial/thymian-workspace#185.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Likely a mis-declaration, not a real impossibility: this is a MAY, and the gate doc's own test for a MAY -- would Thymian see a difference in the messages available to it -- is satisfied by Thymian's own generated request's header choices. See thymianofficial/thymian-workspace#185.",
        },
      },
    },
    'rfc9110/sender-should-generate-trailer-header-when-sending-trailers': {
      covers: ['6.6.2'],
      declared: { types: ['analytics', 'test'], severity: 'warn' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "This rule reads and counts the real response's trailer fields via validateHttpTransactions; static's own version needs a plain predicate function and, separately, has no way to represent trailers actually sent (a runtime fact) versus merely declared.",
        },
      },
    },
    'rfc9110/recipient-may-treat-the-set-of-received-trailer-fields-as-name-value-pairs':
      {
        covers: ['6.5.2'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/recipient-must-not-merge-trailers-unsafely': {
      covers: ['6.5.1'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/sender-must-not-generate-trailer-unless-permitted': {
      covers: ['6.5.1'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'tool-limitation',
          issue: 'thymianofficial/thymian-workspace#187',
          note: "Verified directly: packages/core/src/format/http-filter-expression-to-transaction-filter.ts's static/lint filter compiler has a working visit* case for every other combinator used in this corpus except visitResponseTrailer, which unconditionally throws 'Response trailers are not currently supported.' Every other filter type here (method, headers, query params, status code, media type) has a real implementation against the schema-derived transaction shape -- only trailer-name filtering was never wired up. Thymian could do this in principle; the implementation cannot yet.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: 'Thymian, playing the client role, receives whatever trailers the server under test chooses to send; it cannot force the server to include a specific forbidden trailer field name on demand.',
        },
      },
    },
    'rfc9110/server-should-not-generate-necessary-trailers': {
      covers: ['6.5.1'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/trailer-fields-must-be-defined-as-list-if-repeatable': {
      covers: ['6.5.2'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/client-may-proceed-to-send-content-without-receiving-100-response':
      {
        covers: ['10.1.1'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/client-must-not-generate-100-continue-without-content': {
      covers: ['10.1.1'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "Possible mis-declaration, lower confidence than this batch's other findings: the condition is two schema-level facts ANDed together -- an operation's declared requestBody is absent (the #173 boolean, a first-class schema construct) AND its Expect header parameter's declared example/pattern says '100-continue' (the #188 header-pinning mechanism, not yet proven in practice for any header). Only the first half inherits a proven mechanism; the second half is the weaker, unproven one. See thymianofficial/thymian-workspace#189.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Same compound, lower-confidence reasoning as the static cell: if a schema declares both facts for the same operation (unusual, and Expect is a hop-by-hop/connection-control header rarely modeled as an explicit parameter with a pinned example, unlike a universal requestBody), Thymian's schema-driven generator would naturally produce the combination. See thymianofficial/thymian-workspace#189.",
        },
      },
    },
    'rfc9110/client-must-send-expect-header-for-100-response': {
      covers: ['10.1.1'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc9110/client-should-not-wait-for-an-indefinite-period-for-100-response':
      {
        covers: ['10.1.1'],
        declared: { types: ['informational'], severity: 'warn' },
      },
    'rfc9110/client-should-repeat-request-without-expect-for-417': {
      covers: ['10.1.1'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/origin-server-must-not-wait-for-content-before-100-continue': {
      covers: ['10.1.1'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/origin-server-must-respond-immediately-to-100-continue-request': {
      covers: ['10.1.1'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/proxy-may-generate-immediate-100-response': {
      covers: ['10.1.1'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/proxy-must-handle-100-continue-expectation': {
      covers: ['10.1.1'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/server-may-omit-sending-100-response-if-already-received-content':
      {
        covers: ['10.1.1'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/server-may-respond-with-417-response-for-other-expect-than-100-continue':
      {
        covers: ['10.1.1'],
        declared: { types: ['analytics'], severity: 'hint' },
        contexts: {
          static: {
            verdict: 'impossible',
            reason: 'not-representable',
            note: "This rule's filter uses requestHeader('expect', '100-continue') -- a value-matching HttpFilterExpression -- passed to the non-Common validateHttpTransactions; static's own version needs a plain predicate function and cannot accept this filter shape.",
          },
          test: {
            verdict: 'impossible',
            reason: 'condition-not-producible',
            note: "Likely a mis-declaration, not a real impossibility: this is a MAY-hint about the server's own choice, and server-must-ignore-range-header-for-unrecognized-method (range-requests batch, #178) already proves the technique -- replay an existing transaction with Expect set to a well-formed, spec-permitted non-'100-continue' token via replayStep().set(...), then check whether the server answers 417. See thymianofficial/thymian-workspace#189.",
          },
        },
      },
    'rfc9110/server-must-ignore-100-continue-in-http-1.0': {
      covers: ['10.1.1'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/server-must-send-final-status-after-100-continue': {
      covers: ['10.1.1'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/server-should-indicate-if-closing-the-connection-when-sending-final-status-code-without-full-request':
      {
        covers: ['10.1.1'],
        declared: { types: ['informational'], severity: 'warn' },
      },
    'rfc9110/robotic-user-agent-should-send-valid-from-header': {
      covers: ['10.1.2'],
      declared: { types: ['analytics'], severity: 'warn' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'Likely a mis-declaration, not a real impossibility: this is a single-header value-format check (does the From value match an email-mailbox pattern), exactly the shape .overrideStaticRule() reading a schema-pinned From pattern/example can express -- see thymianofficial/thymian-workspace#188.',
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "From isn't a header Thymian's schema-driven request generator naturally varies per operation the way a declared body or a declared header enum is; there's no established mechanism in this corpus for constructing a specific mailbox-format value to test against on demand.",
        },
      },
    },
    'rfc9110/server-should-not-use-from-for-authentication': {
      covers: ['10.1.2'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/user-agent-should-not-send-from-without-configuration': {
      covers: ['10.1.2'],
      declared: { types: ['static', 'analytics'], severity: 'warn' },
      contexts: {
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Likely a mis-declaration, not a real impossibility: this is a SHOULD NOT, and the gate doc's own test for it -- would Thymian see a difference in the messages available to it -- is satisfied by Thymian's own generated request's header choices, the same reasoning as client-may-send-if-match-header (#180). See thymianofficial/thymian-workspace#185.",
        },
      },
    },
    'rfc9110/intermediary-should-not-modify-referer-for-same-scheme-and-host': {
      covers: ['10.1.3'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/user-agent-may-truncate-parts-other-than-referring-origin': {
      covers: ['10.1.3'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/user-agent-must-exclude-referer-or-send-about-blank-for-no-source':
      {
        covers: ['10.1.3'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/user-agent-must-not-include-fragment-or-userinfo-in-referer': {
      covers: ['10.1.3'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'Likely a mis-declaration, not a real impossibility: this is a single-header value-format check (does the Referer value carry a fragment or userinfo component), the same .overrideStaticRule()-representable shape as the From/User-Agent siblings in this batch -- see thymianofficial/thymian-workspace#188.',
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Referer identifies a referring page Thymian's API-testing harness doesn't navigate from; there is no natural mechanism in this corpus for constructing a meaningful Referer value (with or without a fragment/userinfo component) to test against.",
        },
      },
    },
    'rfc9110/user-agent-must-not-send-referer-in-unsecured-request-from-secure-resource':
      {
        covers: ['10.1.3'],
        declared: { types: ['analytics'], severity: 'error' },
        contexts: {
          static: {
            verdict: 'impossible',
            reason: 'not-representable',
            note: "Likely a mis-declaration, not a real impossibility: the condition is two fixed schema facts ANDed -- the operation's own protocol is http, and the Referer header's declared example/pattern starts with https:// -- the same .overrideStaticRule()-representable shape as this batch's other value-format rules. See thymianofficial/thymian-workspace#188.",
          },
          test: {
            verdict: 'impossible',
            reason: 'condition-not-producible',
            note: 'Same reasoning as user-agent-must-not-include-fragment-or-userinfo-in-referer: no natural mechanism in this corpus constructs a meaningful Referer value to test against.',
          },
        },
      },
    'rfc9110/user-agent-should-not-send-referer-for-secure-to-insecure': {
      covers: ['10.1.3'],
      declared: { types: ['analytics'], severity: 'warn' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "Likely a mis-declaration, not a real impossibility: comparing the Referer's declared-example origin against the operation's own declared origin is two fixed schema facts, the same .overrideStaticRule()-representable shape as this batch's other value-format rules. See thymianofficial/thymian-workspace#188.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: 'Same reasoning as user-agent-must-not-include-fragment-or-userinfo-in-referer: no natural mechanism in this corpus constructs a meaningful Referer value to test against.',
        },
      },
    },
    'rfc9110/sender-must-send-te-connection-option-with-te-header': {
      covers: ['10.1.4'],
      declared: { types: ['static', 'analytics'], severity: 'error' },
      contexts: {
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Likely a mis-declaration, not a real impossibility: this is the identical hop-by-hop connection-option mechanism as sender-must-send-upgrade-connection-option (routing batch, #171) -- fully within Thymian's own control as the client, needing no server cooperation. See thymianofficial/thymian-workspace#186.",
        },
      },
    },
    'rfc9110/sender-must-not-generate-advertising-in-product-identifier': {
      covers: ['10.1.5'],
      declared: { types: ['analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "Likely a mis-declaration, not a real impossibility: this is a single-header value-format check (does the User-Agent value match one of several promotional-keyword patterns), the same .overrideStaticRule()-representable shape as this batch's other value-format rules. See thymianofficial/thymian-workspace#188.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Thymian's own User-Agent identifier is fixed by the tool itself, not varied per schema or operation; checking it against these patterns in test would only tell us about Thymian's own tooling, not the target under test.",
        },
      },
    },
    'rfc9110/sender-should-limit-generated-product-identifiers-to-necessity': {
      covers: ['10.1.5'],
      declared: { types: ['informational'], severity: 'warn' },
    },
    'rfc9110/sender-should-not-generate-non-version-info-in-product-version': {
      covers: ['10.1.5'],
      declared: { types: ['analytics'], severity: 'warn' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: "Unlike this batch's other value-format rules (#188), this one parses the User-Agent value into an unbounded number of product/version tokens (userAgent.match(/([^\\s/]+)\\/([^\\s)]+)/g)) and then applies a computed classification (version-shaped vs not) per token -- the same structured-parse-plus-computed-property shape that keeps authentication-parameter-name-must-occur-once-per-challenge and realm-parameter-must-use-quoted-string-syntax out of #188, not a single pinned value's shape.",
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Same reasoning as sender-must-not-generate-advertising-in-product-identifier: Thymian's own fixed User-Agent identifier isn't varied per test case.",
        },
      },
    },
    'rfc9110/user-agent-should-limit-addition-of-subproducts-by-third-parties':
      {
        covers: ['10.1.5'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/user-agent-should-not-generate-needlessly-fine-grained-detailed-user-agent-field':
      {
        covers: ['10.1.5'],
        declared: { types: ['informational'], severity: 'hint' },
      },
    'rfc9110/user-agent-should-send-user-agent-header': {
      covers: ['10.1.5'],
      declared: { types: ['analytics'], severity: 'warn' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'Likely a mis-declaration, not a real impossibility: this rule already uses validateCommonHttpTransactions (uniform across static/test/analytics) for a bare-presence check; nothing blocks static. See thymianofficial/thymian-workspace#185.',
        },
        test: {
          verdict: 'impossible',
          reason: 'condition-not-producible',
          note: "Likely a mis-declaration, not a real impossibility: this is a SHOULD, visible in Thymian's own generated request the same way as client-may-send-if-match-header (#180). See thymianofficial/thymian-workspace#185.",
        },
      },
    },
    'rfc9110/origin-server-may-send-allow-header': {
      covers: ['10.2.1'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/proxy-must-not-modify-allow-header': {
      covers: ['10.2.1'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/user-agent-must-inherit-fragment-for-3xx-without-fragment': {
      covers: ['10.2.2'],
      declared: { types: ['informational'], severity: 'hint' },
    },
    'rfc9110/origin-server-may-generate-server-header-field': {
      covers: ['10.2.4'],
      declared: { types: ['static', 'analytics', 'test'], severity: 'hint' },
    },
    'rfc9110/origin-server-should-limit-addition-of-subproducts-by-third-parties':
      {
        covers: ['10.2.4'],
        declared: { types: ['informational'], severity: 'warn' },
      },
    'rfc9110/origin-server-should-not-generate-needlessly-fine-grained-detail-server-header':
      {
        covers: ['10.2.4'],
        declared: { types: ['informational'], severity: 'warn' },
      },
  },
});

export default coverage;
