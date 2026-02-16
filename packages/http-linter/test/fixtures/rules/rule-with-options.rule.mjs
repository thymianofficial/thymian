import { requestHeader } from '@thymian/core';

import { httpRule } from '../../../src/index.js';

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
