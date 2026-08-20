import { constant, httpRule } from '@thymian/core';

export default httpRule('globbed-js-b')
  .severity('error')
  .type('test', 'analytics')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();
