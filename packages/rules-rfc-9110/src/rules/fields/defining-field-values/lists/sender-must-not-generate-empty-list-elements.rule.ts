import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/sender-must-not-generate-empty-list-elements')
  .severity('error')
  // Informational: detecting an empty list element (e.g. a stray "a,,b")
  // requires first knowing that a given field uses the #(list) production.
  // Whether a comma is a list separator is field-specific: in Date, Cookie,
  // ETag with weak validators, and many other fields a comma is ordinary data,
  // not a list delimiter. The framework provides no per-field grammar registry
  // to distinguish list-valued fields from comma-bearing single values, so a
  // generic check across captured header values would produce false positives
  // on legitimate traffic. Honestly deferred to informational rather than
  // shipping an unsound check. Recorded for documentation only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.1')
  .description(
    'In any production that uses the list construct, a sender MUST NOT generate empty list elements.',
  )
  .summary('Sender MUST NOT generate empty list elements.')
  .done();
