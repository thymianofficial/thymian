import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-must-not-generate-https-uri-with-empty-host',
)
  .severity('error')
  // HAR ingestion derives origin from `new URL(url).origin`, which always
  // yields a non-empty host, so an empty-host absolute URI is unrepresentable
  // after URL-based ingestion and there is nothing to observe.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-https-uri-scheme')
  .description(
    `A sender MUST NOT generate an 'https' URI with an empty host identifier.`,
  )
  .appliesTo('client', 'user-agent')
  .done();
