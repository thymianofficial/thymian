import { httpRule } from '@thymian/core';

// Informational: the requirement is an assumption inside the server about
// what it receives. A server that answers the same cookies in another order
// alike may still pick the wrong one of two cookies with one name, and no
// message shows which one it read.
export default httpRule(
  'rfc-6265bis/server-should-not-rely-on-cookie-serialization-order',
)
  .severity('warn')
  .type(
    'informational',
    'peer-not-observable',
    'Relying on the order of the cookies in a Cookie header field is an assumption inside the server, about which cookie it reads when two share a name and where in the field it looks. No message Thymian sees, sends or records shows which of them the server used.',
  )
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-4.2.2',
  )
  .description(
    'Although cookies are serialized linearly in the Cookie header field, servers SHOULD NOT rely upon the serialization order. In particular, if the Cookie header field contains two cookies with the same name (e.g., that were set with different Path or Domain attributes), servers SHOULD NOT rely upon the order in which these cookies appear in the header field.',
  )
  .summary(
    'Server should not rely on the order of the cookies in the Cookie header.',
  )
  .explanation(
    'A browser sorts the cookies it sends by path length and creation time, but not every browser does, and a proxy may reorder or split the field. Two cookies may also share a name when they were set with a different Path or Domain, and then the order is the only thing that tells them apart. A server that takes the first or the last such cookie may read one set for another part of the site, which is also how an attacker on a sibling subdomain can shadow a session cookie. Give cookies distinct names, and treat a repeated name as ambiguous.',
  )
  .appliesTo('server')
  .done();
