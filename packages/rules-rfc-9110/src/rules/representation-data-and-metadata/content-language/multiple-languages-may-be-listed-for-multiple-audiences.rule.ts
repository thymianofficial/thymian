import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/multiple-languages-may-be-listed-for-multiple-audiences',
)
  .severity('hint')
  .type('informational')
  .appliesTo('origin server')
  .description(
    'Multiple languages MAY be listed for content that is intended for multiple audiences.',
  )
  .summary('Multiple languages MAY be listed in Content-Language.')
  .done();
