import { and, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/server-may-send-content-length-for-304')
  .severity('off')
  .type('informational')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6')
  .description(
    `A server MAY send a Content-Length header field in a 304 (Not Modified) response to a conditional GET request;
    a server MUST NOT send Content-Length in such a response unless its field value equals the decimal number of
    octets that would have been sent in the content of a 200 (OK) response to the same request. This is useful for
    cache validation but cannot be automatically validated without access to what the 200 response would contain.`,
  )
  .summary(
    'Servers MAY send Content-Length in 304 responses if it matches what 200 would return.',
  )
  .done();
