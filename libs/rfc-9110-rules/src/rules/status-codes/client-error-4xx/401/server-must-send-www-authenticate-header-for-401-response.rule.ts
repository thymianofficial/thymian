import { equalsIgnoreCase, httpRule } from '@thymian/http-linter';
import {
  expectHeaders,
  expectStatusCode,
  forHttpTransactions,
  generateRequests,
  runRequests,
  toTestCases,
} from '@thymian/http-testing';
import { getHeader, type JSONSchemaType } from '@thymian/core';
import assert from 'node:assert';
import * as console from 'node:console';

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
  'rfc9110/server-must-send-www-authenticate-header-for-401-response'
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-401-unauthorized')
  .options<Options>(optionSchema)
  .description(
    'The server generating a 401 response MUST send a WWW-Authenticate header field containing at least one challenge applicable to the target resource.'
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      (_, res) => res.statusCode === 401,
      (_, res) => !equalsIgnoreCase('www-authenticate', ...res.headers)
    )
  )
  .overrideTest((testContext, options) =>
    testContext.test((t) =>
      t.pipe(
        forHttpTransactions(
          (req, reqId) =>
            !equalsIgnoreCase(req.method, 'head') &&
            (options.checkAllSecured
              ? testContext.format.requestIsSecured(reqId)
              : true),
          (res) => (options.checkAllSecured ? true : res.statusCode === 401)
        ),
        toTestCases(),
        generateRequests(1, { authenticate: false }),
        runRequests({ checkStatusCode: false }),
        expectStatusCode(401),
        expectHeaders((headers, transaction) => {
          console.log({ headers });
          console.log(transaction.response?.statusCode);
          const wwwAuthenticateHeader = getHeader(headers, 'www-authenticate');

          assert.ok(wwwAuthenticateHeader);
        })
      )
    )
  )
  .done();
