import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/intermediary-must-implement-connection-header')
  .severity('error')
  // "Implement the Connection header" is a capability requirement; conformance shows up only in downstream forwarding behavior, not as a single observable message artifact.
  .type('informational')
  // An intermediary that does not implement Connection-header exclusion forwards hop-by-hop fields verbatim, letting the next hop see control information meant only for this one — framing integrity, not named "smuggling" by the RFC.
  .tags('security:request-smuggling')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-message-forwarding')
  .description(
    'An intermediary not acting as a tunnel MUST implement the Connection header field, as specified in Section 7.6.1, and exclude fields from being forwarded that are only intended for the incoming connection. This ensures proper hop-by-hop header handling.',
  )
  .summary('Intermediary MUST implement Connection header field.')
  .appliesTo('proxy', 'gateway')
  .done();
