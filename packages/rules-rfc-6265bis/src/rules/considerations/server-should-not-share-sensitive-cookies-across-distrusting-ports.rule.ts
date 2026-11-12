import { httpRule } from '@thymian/core';

// Informational: the requirement turns on which services of a host distrust
// each other and which cookies carry security-sensitive information. Both
// are the origin's own knowledge.
export default httpRule(
  'rfc-6265bis/server-should-not-share-sensitive-cookies-across-distrusting-ports',
)
  .severity('warn')
  .type(
    'informational',
    'only-origin-knows',
    "A cookie is shared by every port of its host, so the requirement applies only where two of those ports run services that distrust each other and the cookies carry security-sensitive information. Whether two services distrust each other, and which cookies are sensitive, is the origin's own knowledge: two ports in the traffic say nothing of who runs them.",
  )
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-8.5',
  )
  .description(
    'Cookies do not provide isolation by port. If a cookie is readable by a service running on one port, the cookie is also readable by a service running on another port of the same server. If a cookie is writable by a service on one port, the cookie is also writable by a service running on another port of the same server. For this reason, servers SHOULD NOT both run mutually distrusting services on different ports of the same host and use cookies to store security-sensitive information.',
  )
  .summary(
    'Server should not keep sensitive cookies on a host whose ports run mutually distrusting services.',
  )
  .explanation(
    'A browser sends the cookies of a host to every port of it, and lets every port set them. A service on another port of the same host, such as an admin tool or a third-party app, can read a session cookie of the main service and overwrite it. Keep services that do not trust each other on different hosts, or keep security-sensitive data out of their cookies.',
  )
  .appliesTo('server')
  .done();
