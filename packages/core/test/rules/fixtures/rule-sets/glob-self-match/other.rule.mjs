import { constant, httpRule } from '@thymian/core';

export default httpRule('glob-self-match-other')
  .severity('error')
  .type('test')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();
