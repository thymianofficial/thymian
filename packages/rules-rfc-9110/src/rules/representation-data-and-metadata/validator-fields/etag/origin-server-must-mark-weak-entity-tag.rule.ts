import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/origin-server-must-mark-weak-entity-tag')
  .severity('error')
  // Informational (outcome 2): whether an entity tag MUST be marked weak (W/)
  // depends on whether the server's tag-generation mechanism satisfies the
  // characteristics of a strong validator — i.e. whether the value is
  // guaranteed to change on every observable change to the representation. That
  // is a property of the server's internal generation logic, not of the tag
  // value on the wire (a strong-looking ETag is not necessarily a violation), so
  // it cannot be validated automatically. Confirmable only by code review.
  .type('informational')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3')
  .description(
    `If an origin server provides an entity tag for a representation and the generation of that entity tag does not
    satisfy all of the characteristics of a strong validator, then the origin server MUST mark the entity tag as weak
    by prefixing its opaque value with "W/" (case-sensitive).

    Note: This rule cannot be automatically validated because it requires knowledge of the server's entity tag
    generation mechanism and whether it satisfies the characteristics of a strong validator (changes value whenever
    the representation data changes in an observable way). This must be verified through code review of the ETag
    generation logic.`,
  )
  .summary('Origin servers MUST mark weak entity tags with "W/" prefix.')
  .done();
