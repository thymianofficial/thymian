import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/sender-must-not-generate-userinfo-in-uri')
  .severity('error')
  // HAR ingestion normalizes the target URI via `new URL(url).origin`, which
  // STRIPS any userinfo subcomponent before we ever see the request. The only
  // userinfo that survives in real traffic lives inside URI-bearing header
  // VALUES (e.g. Referer), and that case is already covered by
  // message-context/request-context/referer/
  // user-agent-must-not-include-fragment-or-userinfo-in-referer.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-deprecation-of-userinfo-in-http',
  )
  .description(
    "A sender MUST NOT generate the userinfo subcomponent (and its '@' delimiter) when an 'http' or 'https' URI reference is generated within a message as a target URI or field value.",
  )
  .appliesTo('client', 'user-agent')
  .done();
