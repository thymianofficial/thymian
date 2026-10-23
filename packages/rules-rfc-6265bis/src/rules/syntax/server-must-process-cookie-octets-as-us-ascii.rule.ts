import { httpRule } from '@thymian/core';

// The note names no actor, so it binds whoever produces a cookie too (the
// counting rule's 3/3). What it asks is how an implementation interprets the
// octets it parses, which happens inside that implementation; the octets on
// the wire that are no US-ASCII are the grammar rule's violation.
export default httpRule(
  'rfc-6265bis/server-must-process-cookie-octets-as-us-ascii',
)
  .severity('error')
  .type(
    'informational',
    'peer-not-observable',
    'Processing the octets of a cookie as US-ASCII characters is a matter of how an implementation interprets what it parses, which happens inside it: no message Thymian sees, sends or records shows which character set the other side decoded a cookie with. A Set-Cookie line that carries octets outside US-ASCII is what the wire does show, and server-must-send-set-cookie-conforming-to-grammar reports it.',
  )
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-3',
  )
  .description(
    "Note: A cookie's octets MUST be processed as [USASCII] characters. While it's possible a non-HTTP API could pass a set-cookie-string with one or more non-[USASCII] characters, no attempt should be made to interpret these octets as anything other than [USASCII] characters.",
  )
  .summary("A cookie's octets must be processed as US-ASCII characters.")
  .explanation(
    'Cookie names, values and attributes are US-ASCII. An implementation that decodes them as UTF-8 or another character set can read a cookie differently from the one that set it, so two parts of one system disagree about what a cookie says. Keep cookies to printable US-ASCII and encode anything else, for example with Base64.',
  )
  .appliesTo('server')
  .done();
