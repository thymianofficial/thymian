import { httpRule } from '@thymian/core';

// Informational: as for ports, the requirement turns on which services of a
// host distrust each other and which cookies carry security-sensitive
// information. Both are the origin's own knowledge.
export default httpRule(
  'rfc-6265bis/server-should-not-share-sensitive-cookies-across-distrusting-paths',
)
  .severity('warn')
  .type(
    'informational',
    'only-origin-knows',
    "The Path attribute gives a cookie no integrity, so the requirement applies only where two paths of one host run services that distrust each other and the cookies carry security-sensitive information. Whether two services distrust each other, and which cookies are sensitive, is the origin's own knowledge: two path prefixes in the traffic say nothing of who runs them.",
  )
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-8.6',
  )
  .description(
    'Even though the Set-Cookie header field supports the Path attribute, the Path attribute does not provide any integrity protection because the user agent will accept an arbitrary Path attribute in a Set-Cookie header field. For example, an HTTP response to a request for http://site.example/foo/bar can set a cookie with a Path attribute of "/qux". Consequently, servers SHOULD NOT both run mutually distrusting services on different paths of the same host and use cookies to store security-sensitive information.',
  )
  .summary(
    'Server should not keep sensitive cookies on a host whose paths run mutually distrusting services.',
  )
  .explanation(
    'A browser lets a response from any path of a host set a cookie for any other path of it, and some browsers let a page on one path read the cookies of another through script. Path does not separate two services on one host: one can overwrite, and may read, the session cookie of the other. Keep services that do not trust each other on different hosts, or keep security-sensitive data out of their cookies.',
  )
  .appliesTo('server')
  .done();
