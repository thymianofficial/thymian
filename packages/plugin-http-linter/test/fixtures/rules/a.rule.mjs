import { constant, httpRule } from '@thymian/core';

export default httpRule('a')
  .severity('error')
  .type('static', 'test')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();
