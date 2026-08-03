import { statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-may-respond-with-404-instead-of-403',
)
  .severity('hint')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-403-forbidden')
  .description(
    'An origin server that wishes to "hide" the current existence of a forbidden target resource MAY instead respond with a status code of 404 (Not Found).',
  )
  .explanation(
    'A 403 (Forbidden) tells the client the resource exists but access is refused. If the server would rather not reveal that the resource exists at all, it is allowed to return 404 (Not Found) instead. This is optional. It matters for privacy and security: on sensitive resources, admitting existence via 403 can leak information to an attacker, so responding with 404 lets the server conceal whether the resource is there while still denying access.',
  )
  .appliesTo('origin server')
  .rule((ctx) => ctx.validateCommonHttpTransactions(statusCode(403)))
  .done();
