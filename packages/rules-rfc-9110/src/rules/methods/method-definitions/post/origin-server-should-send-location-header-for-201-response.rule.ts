import { and, method, not, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-send-location-header-for-201-response',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-post')
  .summary(
    'Origin server should send 201 (Created) response containing a Location header for the primary created resource.',
  )
  .description(
    'If one or more resources has been created on the origin server as a result of successfully processing a POST request, the origin server SHOULD send a 201 (Created) response containing a Location header field that provides an identifier for the primary resource created and a representation that describes the status of the request while referring to the new resource(s).',
  )
  .explanation(
    'When a POST creates one or more new resources, your server should respond 201 (Created) and include a Location header giving the URL of the primary resource it just made. This matters because POST does not name the resource in advance, so without a Location header the client has no way to learn where the new resource lives; supplying it lets the client link to, fetch, or update what was created instead of having to guess the address.',
  )
  .appliesTo('origin server')
  .rule((context) =>
    context.validateCommonHttpTransactions(
      and(method('POST'), statusCode(201)),
      not(responseHeader('location')),
    ),
  )
  .done();
