import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/recipient-must-reject-http-uri-without-host')
  .severity('error')
  // Informational (#327): unobservable. The check was gated on
  // `new URL(req.path, req.origin).host === ''`, but HAR ingestion derives
  // origin from `new URL(url).origin`, which always yields a non-empty host —
  // an empty-host URI is unrepresentable after URL-based ingestion, so the
  // predicate is vacuous (can never fire) and the response-status half never
  // runs. Documenting the requirement is all that remains.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-http-uri-scheme')
  .description(
    `A recipient that processes a 'http' URI reference with empty host MUST reject it as invalid.`,
  )
  .appliesTo('origin server', 'server')
  .done();
