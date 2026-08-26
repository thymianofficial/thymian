import { constant, httpRule } from '@thymian/core';

export default httpRule('glob-basic-z')
  .severity('warn')
  .type('test')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();
