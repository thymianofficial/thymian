import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- semantic ambiguity Thymian cannot judge, not a concern this vocabulary covers
export default httpRule('rfc9110/content-location-201-response-semantics')
  .severity('hint')
  .type(
    'informational',
    'origin-internal-ground-truth',
    'Whether Content-Location matching (or differing from) Location in a 201 is correct depends on what the returned content actually represents — a fact only the origin server knows. Either arrangement is valid on the wire.',
  )
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.7')
  .description(
    `For a 201 (Created) response, if the Content-Location field value is identical to the Location header field value,
    then the representation is a current representation of the newly created resource. If the values differ, the
    representation is a representation of some resource related to the creation but not the created resource itself.

    Example:
    - POST /items -> 201 Created
      Location: /items/123
      Content-Location: /items/123
      (Content represents the newly created resource at /items/123)

    - POST /items -> 201 Created
      Location: /items/123
      Content-Location: /items/summary
      (Content represents a summary, not the created resource itself)

    Note: This rule cannot be automatically validated because it requires semantic understanding of whether
    Content-Location matches Location in 201 responses, and whether that match is intentional.`,
  )
  .summary(
    'In 201 responses, Content-Location semantics depend on whether it matches Location.',
  )
  .done();
