import { type JSONSchemaType } from '@thymian/core';
import { and, method, not, responseHeader, statusCode } from '@thymian/core';
import { httpRule, singleTestCase } from '@thymian/core';

type Options = Record<never, never>;

// The rule takes no options. The empty schema exists to reject the removed
// `checkAllSecured` option: a rule without a schema would silently ignore it.
const optionSchema: JSONSchemaType<Options> = {
  type: 'object',
  additionalProperties: false,
  properties: {},
};

export default httpRule(
  'rfc9110/server-must-send-www-authenticate-header-for-401-response',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .tags('security:authentication')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-401-unauthorized')
  .options<Options>(optionSchema)
  .description(
    'The server generating a 401 response MUST send a WWW-Authenticate header field containing at least one challenge applicable to the target resource.',
  )
  .explanation(
    'When a server returns 401 (Unauthorized), it must include a WWW-Authenticate header describing at least one authentication challenge that applies to the requested resource. The 401 says credentials are missing or invalid; the challenge tells the client how to authenticate. It matters because without the challenge the client knows only that it was denied, not which authentication scheme or realm to use, so it cannot construct a proper Authorization header and retry.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(401),
      not(responseHeader('www-authenticate')),
    ),
  )
  .overrideTest((testContext) =>
    testContext.httpTest(
      singleTestCase()
        .forTransactionsWith(and(not(method('HEAD')), statusCode(401)))
        .run({ authorize: false })
        .expectForTransactions(responseHeader('www-authenticate'))
        .done(),
    ),
  )
  .done();
