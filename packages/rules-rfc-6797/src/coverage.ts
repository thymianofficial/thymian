// RFC 6797's denominator (ADR-0021 §5). RFC 6797 carries a real conformance
// clause (§3: a conformant host implements every requirement applicable to
// hosts), so its unit is a keyword paragraph — but only in the chapters a
// host can be held to. §6 (the header field's syntax), §7 (the server
// processing model) and §9.2 (the effective request URI) are the host's; §8
// and §13 are the user agent's processing model, which Thymian cannot
// observe; §11 and §12 open with "This section is non-normative."
//
// Counted from the document, never from the rules: derived by splitting
// https://www.rfc-editor.org/rfc/rfc6797.txt (November 2012) into
// paragraphs, dropping page headers and footers, and keeping every paragraph
// of §6, §7 and §9.2 that contains at least one of MUST, MUST NOT, REQUIRED,
// SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, MAY or OPTIONAL. 14
// qualify, and no page break in those sections splits a paragraph. Two of
// them are NOTEs in §7 that quote a keyword to explain one; the counting
// rule counts them. Three of §6.1's are addressed to the user agent; each is
// a unit like any other.
//
// A unit's id is `<section>/<n>`: n is the paragraph's position among that
// section's keyword paragraphs, so the id is re-derivable from the counting
// rule alone.
//
// The per-rule entries arrive with the rules; until then every unit renders
// as not yet covered.

import { defineCoverage } from '@thymian/core';

const units = {
  '6.1/1':
    'The STS header field indicates to a UA that it MUST enforce the HSTS Policy in regards to the host emitting the response.',
  '6.1/2': 'All directives MUST appear only once in an STS header field.',
  '6.1/3':
    'UAs MUST ignore any STS header field containing directives, or other header field value data, that does not conform to the syntax.',
  '6.1/4':
    'If an STS header field contains directives not recognized by the UA, the UA MUST ignore them and process the recognized ones.',
  '6.1.1/1':
    'The REQUIRED max-age directive specifies how many seconds the UA regards the host as a Known HSTS Host.',
  '6.1.1/2':
    "The max-age directive's REQUIRED value is delta-seconds (1*DIGIT), after quoted-string unescaping.",
  '6.1.2/1':
    'The OPTIONAL includeSubDomains directive is a valueless directive that extends the HSTS Policy to subdomains.',
  '7.1/1':
    'Over secure transport, an HSTS Host SHOULD include an STS header field that MUST satisfy the §6.1 grammar, and MUST include only one.',
  '7.1/2':
    'Establishing a Known HSTS Host MAY be accomplished by returning a valid STS header field over secure transport; a pre-loaded list MAY also be used.',
  '7.1/3':
    'NOTE: including the STS header field is a SHOULD to accommodate caches and load balancing.',
  '7.2/1':
    'Over non-secure transport, an HSTS Host SHOULD answer with a permanent redirect whose Location has the https scheme.',
  '7.2/2':
    'NOTE: the redirect is a SHOULD rather than a MUST because of redirect risks and deployment characteristics.',
  '7.2/3':
    'An HSTS Host MUST NOT include the STS header field in HTTP responses conveyed over non-secure transport.',
  '9.2/1':
    'Effective request URIs are compared per RFC 2616 §3.2.3, except that empty path components MUST NOT be treated as equivalent to an absolute path of "/".',
} as const;

export default defineCoverage({
  source: {
    revision: 'RFC 6797 (November 2012)',
    countingRule:
      'One unit per paragraph of §6, §7 and §9.2 — the chapters addressed to the host — that contains a BCP 14 keyword.',
    hasKeywordBasis: true,
  },
  units,
  rules: {},
});
