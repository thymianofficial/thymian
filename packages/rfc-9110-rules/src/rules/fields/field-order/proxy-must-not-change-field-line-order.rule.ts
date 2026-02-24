import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/proxy-must-not-change-field-line-order')
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.3')
  .description(
    'The order in which field lines with the same name are received is therefore significant to the interpretation of the field value; a proxy MUST NOT change the order of these field line values when forwarding a message.',
  )
  .summary(
    'Proxy MUST NOT change the order of field line values when forwarding.',
  )
  .appliesTo('proxy')
  .tags('fields', 'field-order', 'proxy')
  .done();
