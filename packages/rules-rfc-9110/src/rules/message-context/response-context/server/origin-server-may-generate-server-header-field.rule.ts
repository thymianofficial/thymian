import { not, responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-may-generate-server-header-field',
)
  .severity('hint')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-server')
  .description(
    'An origin server MAY generate a Server header field in its responses.',
  )
  .explanation(
    'An origin server is allowed, but not required, to include a Server header that names the software handling the request, typically with its version. This is optional and purely informational: clients use it to scope reported interoperability problems, to tailor requests around known server quirks, and for analytics about server software. Keep in mind that overly detailed values can leak internal implementation details, so many operators either omit it or keep it minimal.',
  )
  .appliesTo('origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(not(responseHeader('server'))),
  )
  .done();
