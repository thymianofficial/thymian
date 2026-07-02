import { httpRule } from '@thymian/core';

// The MUST NOT is gated by an "unless" exception that is broadly satisfied in
// practice — a validator (ETag/Last-Modified) IS permitted when the PUT
// representation was stored without transformation and the validator value
// reflects that stored representation. Whether the server applied a
// transformation, and whether the validator reflects the new representation, is
// server-internal state that no message exposes. The violating condition cannot
// be distinguished from the permitted one with observable data.
export default httpRule(
  'rfc9110/origin-server-must-not-sent-validator-field-in-response-to-put-request',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .description(
    "An origin server MUST NOT send a validator field, such as an ETag or Last-Modified field, in a successful response to PUT unless the request's representation data was saved without any transformation applied to the content (i.e., the resource's new representation data is identical to the content received in the PUT request) and the validator field value reflects the new representation.",
  )
  .appliesTo('origin server')
  .done();
