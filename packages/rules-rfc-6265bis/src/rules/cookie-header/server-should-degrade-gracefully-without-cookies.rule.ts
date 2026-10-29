import { httpRule } from '@thymian/core';

// Informational: an error answer to a request that lacks a cookie is either
// the failure to degrade the requirement is about, or the right refusal of a
// request that needs the cookie, such as an unauthenticated one. Which of
// the two only the origin knows.
export default httpRule(
  'rfc-6265bis/server-should-degrade-gracefully-without-cookies',
)
  .severity('warn')
  .type(
    'informational',
    'only-origin-knows',
    'Whether a server degrades gracefully turns on what it should do without the cookie: an error answer to a request that lacks one is a failure to degrade, or the right refusal of a request that needs it, such as one that must be authenticated. Only the origin knows which of its cookies a request can do without.',
  )
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-6.1',
  )
  .description(
    'Servers SHOULD gracefully degrade if the user agent fails to return one or more cookies in the Cookie header field because the user agent might evict any cookie at any time.',
  )
  .summary(
    'Server should degrade gracefully when a browser does not return a cookie.',
  )
  .explanation(
    'A browser may evict any cookie at any time: when it reaches its limits, when the user clears some, or under a privacy policy. A server that fails with an error, loops on a redirect or corrupts state when a cookie is missing breaks for exactly those users. Treat every cookie as optional input: fall back to a default, or ask the user to sign in again.',
  )
  .appliesTo('server')
  .done();
