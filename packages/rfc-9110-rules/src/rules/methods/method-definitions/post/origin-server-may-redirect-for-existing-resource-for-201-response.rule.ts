import { and, method, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-may-redirect-for-existing-resource-for-201-response',
)
  .severity('hint')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-post')
  .description(
    "If the result of processing a POST would be equivalent to a representation of an existing resource, an origin server MAY redirect the user agent to that resource by sending a 303 (See Other) response with the existing resource's identifier in the Location field.",
  )
  .appliesTo('origin server')
  .rule((context) =>
    context.validateCommonHttpTransactions(
      and(method('POST'), statusCode(201)),
    ),
  )
  .done();
