import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-must-treat-content-location-as-transitory-context',
)
  .severity('error')
  .type('informational')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.7')
  .description(
    `An origin server that receives a Content-Location field in a request message MUST treat the information
    as transitory request context rather than as metadata to be saved verbatim as part of the representation.
    An origin server MUST NOT use such context information to alter the request semantics.

    Note: This rule cannot be automatically validated because it concerns server-internal handling of Content-Location
    in request messages. Compliance requires verifying through code review that the server does not persist
    Content-Location as representation metadata or use it to modify request semantics.`,
  )
  .summary(
    'Origin servers MUST treat Content-Location in requests as transitory context.',
  )
  .done();
