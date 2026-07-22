import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-must-not-generate-multiple-field-lines-unless-allowed',
)
  .severity('error')
  // Flagging a repeated field line requires knowing whether that field's
  // definition permits list recombination (#(values)); this needs a complete
  // per-field registry of list-typed fields that the framework does not have, so
  // any generic check would misfire on legitimately repeatable fields.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.3')
  .description(
    "This means that, aside from the well-known exception noted below, a sender MUST NOT generate multiple field lines with the same name in a message (whether in the headers or trailers) or append a field line when a field line of the same name already exists in the message, unless that field's definition allows multiple field line values to be recombined as a comma-separated list (i.e., at least one alternative of the field's definition allows a comma-separated list, such as an ABNF rule of #(values) defined in Section 5.6.1).",
  )
  .summary(
    'Sender MUST NOT generate multiple field lines with the same name unless the field definition allows it.',
  )
  .done();
