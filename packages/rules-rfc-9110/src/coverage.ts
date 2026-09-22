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
  },
});
