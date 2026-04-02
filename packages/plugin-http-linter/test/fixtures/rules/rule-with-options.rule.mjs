import { httpRule, requestHeader } from '@thymian/core';

export default httpRule('rule-with-options')
  .severity('warn')
  .type('static')
  .options({
    type: 'object',
    nullable: false,
    required: ['foo'],
    properties: {
      foo: {
        type: 'string',
      },
    },
  })
  .rule((ctx, options) =>
    ctx.validateCommonHttpTransactions(requestHeader(options.foo)),
  )
  .done();
