import { httpRule } from '@thymian/core';

// The SHOULD is conditioned on the server receiving a method that is
// "recognized and implemented, but not allowed for the target resource".
// Whether a given method is allowed for a resource is server-side policy that
// is not declared anywhere observable: neither a single response nor a HAR
// reveals the server's allow-list, and we cannot synthesize a request that is
// guaranteed to be "recognized but disallowed" for testing. The conformant
// condition therefore cannot be detected.
export default httpRule(
  'rfc9110/origin-server-should-send-405-response-for-unallowed-method',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-overview')
  .description(
    'An origin server that receives a request method that is recognized and implemented, but not allowed for the target resource, SHOULD respond with the 405 (Method Not Allowed) status code.',
  )
  .appliesTo('origin server')
  .done();
