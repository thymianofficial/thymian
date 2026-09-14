import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/origin-server-should-response-with-409-or-415-status-code-to-put-request-for-inconsistent-representation',
)
  .severity('warn')
  .type(
    'informational',
    'origin-internal-ground-truth',
    "The triggering condition — whether a PUT representation is inconsistent with the server's own target-resource state — is server-internal and exposed by no message; even then 409/415 are only suggested, not required, since the server may instead make the representation consistent and succeed.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .description(
    'When a PUT representation is inconsistent with the target resource, the origin server SHOULD either make them consistent, by transforming the representation or changing the resource configuration, or respond with an appropriate error message containing sufficient information to explain why the representation is unsuitable. The 409 (Conflict) or 415 (Unsupported Media Type) status codes are suggested, with the latter being specific to constraints on Content-Type values.',
  )
  .appliesTo('origin server')
  .done();
