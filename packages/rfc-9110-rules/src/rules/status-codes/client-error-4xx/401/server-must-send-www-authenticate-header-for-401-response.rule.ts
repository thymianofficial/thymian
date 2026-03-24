import { type JSONSchemaType } from '@thymian/core';
import {
  and,
  authorization,
  constant,
  method,
  not,
  or,
  responseHeader,
  responseWith,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';
import { singleTestCase } from '@thymian/http-testing';

type Options = {
  checkAllSecured?: boolean;
};

const optionSchema: JSONSchemaType<Options> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    checkAllSecured: {
      nullable: true,
      type: 'boolean',
      default: false,
    },
  },
};

export default httpRule(
  'rfc9110/server-must-send-www-authenticate-header-for-401-response',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-401-unauthorized')
  .options<Options>(optionSchema)
  .description(
    'The server generating a 401 response MUST send a WWW-Authenticate header field containing at least one challenge applicable to the target resource.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(401),
      not(responseHeader('www-authenticate')),
    ),
  )
  .overrideTest((testContext, options) =>
    testContext.httpTest(
      singleTestCase()
        .forTransactionsWith(
          and(
            not(method('HEAD')),
            or(
              and(authorization(), constant(options.checkAllSecured ?? false)),
              responseWith(statusCode(401)),
            ),
          ),
        )
        .run({ authorize: false })
        .expectForTransactions(responseHeader('www-authenticate'))
        .done(),
    ),
  )
  .done();
