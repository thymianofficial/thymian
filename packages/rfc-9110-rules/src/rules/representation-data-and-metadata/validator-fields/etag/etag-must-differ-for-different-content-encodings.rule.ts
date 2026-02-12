import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/etag-must-differ-for-different-content-encodings',
)
  .severity('error')
  .type('informational')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.3')
  .description(
    `Content codings are a property of the representation data. A strong entity tag for a content-encoded
    representation has to be distinct from the entity tag of an unencoded representation to prevent potential
    conflicts during cache updates and range requests.

    For example:
    - GET /resource (no encoding) -> ETag: "abc123"
    - GET /resource (gzip encoded) -> ETag: "def456" (MUST be different)

    In contrast, transfer codings (like chunked encoding) apply only during message transfer and do not
    result in distinct entity tags.

    Note: This rule cannot be automatically validated because it requires comparing ETags across different
    Content-Encoding variants of the same resource, which requires access to multiple representations.`,
  )
  .summary(
    'Strong ETags MUST differ between encoded and unencoded representations.',
  )
  .done();
