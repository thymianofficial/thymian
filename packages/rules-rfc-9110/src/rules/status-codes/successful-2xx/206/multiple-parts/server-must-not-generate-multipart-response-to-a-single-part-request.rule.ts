import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-not-generate-multipart-response-to-a-single-part-request',
)
  .severity('error')
  // Requires determining that the request asked for exactly one range; range
  // counting from the Range header is unreliable across syntaxes and the
  // single-part precondition cannot be established robustly.
  .type('informational')
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-multiple-parts')
  .description(
    'A server MUST NOT generate a multipart response to a request for a single range, since a client that does not request multiple parts might not support multipart responses.',
  )
  .appliesTo('server')
  .done();
