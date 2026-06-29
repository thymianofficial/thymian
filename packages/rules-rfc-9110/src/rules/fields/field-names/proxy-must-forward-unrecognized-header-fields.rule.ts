import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/proxy-must-forward-unrecognized-header-fields')
  .severity('error')
  // Infrastructure-deferred (outcome 3): this MUST governs a proxy's
  // forwarding behavior. Detecting a violation requires correlating the
  // message a proxy received with the message it forwarded and observing that
  // an unrecognized field present on the inbound side was dropped on the
  // outbound side. That before/after-the-proxy linkage is not available from a
  // single captured transaction; it depends on traffic recorded at the proxy
  // (both legs). The rule therefore stays typed `analytics` and scoped to the
  // `proxy` role rather than being downgraded to informational, since it is
  // observable from suitable proxy-side recordings even though no function can
  // be written against a single transaction today.
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.1')
  .description(
    'A proxy MUST forward unrecognized header fields unless the field name is listed in the Connection header field (Section 7.6.1) or the proxy is specifically configured to block, or otherwise transform, such fields.',
  )
  .summary('Proxy MUST forward unrecognized header fields unless excepted.')
  .appliesTo('proxy')
  .done();
