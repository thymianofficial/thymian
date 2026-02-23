import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/server-may-ignore-range-header')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    'A server MAY ignore the Range header field. However, origin servers and intermediate caches ought to support byte ranges when possible, since they support efficient recovery from partially failed transfers and partial retrieval of large representations.',
  )
  .appliesTo('server')
  .done();
