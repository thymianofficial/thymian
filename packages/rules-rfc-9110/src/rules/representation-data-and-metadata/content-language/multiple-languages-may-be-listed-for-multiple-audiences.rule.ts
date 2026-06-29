import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/multiple-languages-may-be-listed-for-multiple-audiences',
)
  .severity('hint')
  // Informational (outcome 2): this is a permissive MAY clarifying that a
  // Content-Language field may list multiple languages for content aimed at
  // multiple audiences. There is no non-conformant condition — listing one or
  // several languages is allowed — so nothing can be flagged.
  //
  // The previous implementation reported a violation for EVERY response that
  // merely carried a Content-Language header, i.e. it flagged perfectly
  // conformant traffic. Reclassified to informational with no rule function.
  .type('informational')
  .appliesTo('origin server')
  .description(
    'Multiple languages MAY be listed for content that is intended for multiple audiences.',
  )
  .summary('Multiple languages MAY be listed in Content-Language.')
  .done();
