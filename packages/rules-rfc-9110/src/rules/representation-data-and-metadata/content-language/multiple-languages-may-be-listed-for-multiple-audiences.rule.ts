import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/multiple-languages-may-be-listed-for-multiple-audiences',
)
  .severity('hint')
  // Pure permission (MAY list multiple languages). Whether a multi-language
  // value is appropriate depends on the intended audience, which is not
  // observable, and either choice is conformant.
  .type('informational')
  .appliesTo('origin server')
  .description(
    'Multiple languages MAY be listed for content that is intended for multiple audiences.',
  )
  .summary('Multiple languages MAY be listed in Content-Language.')
  .done();
