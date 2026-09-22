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

import { defineCoverage } from '@thymian/core';

export default defineCoverage({
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
  units: {
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
  },
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
  },
});
