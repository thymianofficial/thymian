import { constant, httpRule } from '@thymian/core';

export default httpRule('b')
  .severity('warn')
  .type('test')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();
