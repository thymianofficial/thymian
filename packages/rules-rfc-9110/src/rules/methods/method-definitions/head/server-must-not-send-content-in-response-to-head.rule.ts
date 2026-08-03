import { and, hasResponseBody, httpRule, method } from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-not-send-content-in-response-to-head',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-head')
  .description(
    'The HEAD method is identical to GET except that the server MUST NOT send content in the response.',
  )
  .explanation(
    'A HEAD request behaves like a GET but asks only for the headers, so the server must return no response body at all. HEAD exists precisely to obtain header metadata for a resource, such as its size or modification time, without transferring the representation itself. A client issuing HEAD does not expect and will not read a body, so sending one wastes bandwidth and defeats the purpose of using HEAD instead of GET.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(and(method('HEAD'), hasResponseBody())),
  )
  .done();
