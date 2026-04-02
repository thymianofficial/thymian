import { responseHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/content-encoding-should-not-include-identity')
  .severity('warn')
  .type('test', 'analytics')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4')
  .description(
    `The coding named "identity" is reserved for its special role in Accept-Encoding and thus SHOULD NOT be included in Content-Encoding.`,
  )
  .summary('Content-Encoding header SHOULD NOT include "identity" coding.')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      responseHeader('content-encoding', 'identity'),
    ),
  )
  .done();
