import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-may-send-www-authenticate-in-other-responses',
)
  .severity('hint')
  // Informational (outcome 2): this is a permissive MAY with no non-conformant
  // condition. A server is allowed — but never required — to add a
  // WWW-Authenticate header field to responses other than 401 to hint that
  // (different) credentials might change the result. Neither presence nor
  // absence of the header is a violation, so there is nothing to validate.
  //
  // The previous implementation declared `static, test, analytics` and called
  // `validateCommonHttpTransactions(not(responseHeader('www-authenticate')))`
  // with NO validation callback, which flags every response that does *not*
  // carry WWW-Authenticate as a violation — i.e. it penalised servers for not
  // exercising an optional permission. That inverts the rule and fires on
  // essentially all traffic. The active contexts and rule function have been
  // removed in favour of an honest informational classification.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-authenticating-users-to-ori',
  )
  .description(
    'A server MAY generate a WWW-Authenticate header field in other response messages to indicate that supplying credentials (or different credentials) might affect the response.',
  )
  .appliesTo('origin server')
  .done();
