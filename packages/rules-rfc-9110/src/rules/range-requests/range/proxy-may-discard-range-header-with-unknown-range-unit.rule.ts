import { requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/proxy-may-discard-range-header-with-unknown-range-unit',
)
  .severity('hint')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-range')
  .description(
    'A proxy MAY discard a Range header field that contains a range unit it does not understand.',
  )
  .summary(
    'A proxy may discard a Range header field that contains a range unit it does not understand.',
  )
  .explanation(
    'If a proxy sees a Range header whose range unit it does not recognise (anything other than a unit it knows, such as bytes), it is allowed to strip that header before forwarding the request rather than pass it along. This is permissive, not required, but it lets an intermediary avoid relaying a range instruction it cannot reason about, so the origin server simply returns the full resource instead of acting on an unit the proxy could not validate.',
  )
  .appliesTo('proxy')
  .rule((ctx) => ctx.validateHttpTransactions(requestHeader('range')))
  .done();
