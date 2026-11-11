import { httpRule } from '@thymian/core';

// Informational: relying on a cookie being kept is a server-internal
// assumption, and whether a browser kept one is the browser's store, which
// no message shows.
export default httpRule(
  'rfc-6265bis/server-should-not-rely-on-user-agents-retaining-cookies',
)
  .severity('warn')
  .type(
    'informational',
    'peer-not-observable',
    'Relying on a browser retaining a cookie is an assumption inside the server, and whether a browser kept a cookie, or evicted it under its storage limits, is the state of its cookie store. No message Thymian sees, sends or records shows either: a request without a cookie looks the same whether the browser evicted it or never had it.',
  )
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-8.6',
  )
  .description(
    'Finally, an attacker might be able to force the user agent to delete cookies by storing a large number of cookies. Once the user agent reaches its storage limit, the user agent will be forced to evict some cookies. Servers SHOULD NOT rely upon user agents retaining cookies.',
  )
  .summary('Server should not rely on browsers retaining its cookies.')
  .explanation(
    "An attacker who can set cookies for a host, from a sibling domain or a plain-http response, can fill the browser's store until it evicts the cookies the server set. A server that treats a missing cookie as proof of something, such as a consent never given or a check already passed, can be steered that way. Treat a missing cookie as unknown, and keep security decisions on the server.",
  )
  .appliesTo('server')
  .done();
