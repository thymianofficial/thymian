import { constant, httpRule } from '@thymian/core';

export default httpRule('a')
  .severity('error')
  .type('test')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();
