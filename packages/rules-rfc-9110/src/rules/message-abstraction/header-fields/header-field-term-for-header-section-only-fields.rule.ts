import { httpRule } from '@thymian/core';

// A terminology definition (what the spec means by "header field"). It imposes
// no requirement on any message, so there is nothing to validate.
export default httpRule(
  'rfc9110/header-field-term-for-header-section-only-fields',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.3')
  .description(
    'We refer to named fields specifically as a "header field" when they are only allowed to be sent in the header section.',
  )
  .summary(
    'Term "header field" specifically refers to fields only allowed in header section.',
  )
  .done();
