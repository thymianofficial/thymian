import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-must-not-generate-http-uri-with-empty-host',
)
  .severity('error')
  // Informational (#327): unobservable. The check tested
  // `new URL(req.path, req.origin).host === ''`, but HAR ingestion derives
  // origin from `new URL(url).origin`, which always yields a non-empty host —
  // an empty-host absolute URI is unrepresentable after URL-based ingestion, so
  // the predicate is vacuous (can never fire). Documenting the requirement is
  // all that remains.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-http-uri-scheme')
  .description(
    `A sender MUST NOT generate an 'http' URI with an empty host identifier.`,
  )
  .appliesTo('client', 'user-agent')
  .done();
