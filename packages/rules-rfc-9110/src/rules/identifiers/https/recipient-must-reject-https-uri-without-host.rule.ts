import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/recipient-must-reject-https-uri-without-host')
  .severity('error')
  // HAR ingestion derives origin from `new URL(url).origin`, which always
  // yields a non-empty host, so an empty-host URI is unrepresentable after
  // URL-based ingestion and there is nothing to observe.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-https-uri-scheme')
  .description(
    `A recipient that processes a 'https' URI reference with empty host MUST reject it as invalid.`,
  )
  .appliesTo('origin server', 'server')
  .done();
