import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/content-location-201-response-semantics')
  .severity('hint')
  // Informational (outcome 2): this describes the SEMANTICS of Content-Location
  // relative to Location in a 201 response (whether the content represents the
  // newly created resource or a related one). Both the "equal" and "differing"
  // cases are valid; which is correct depends on what the body actually
  // represents — semantic intent the framework cannot observe. There is no
  // mechanical non-conformant condition to detect.
  .type('informational')
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
