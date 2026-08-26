import { constant, httpRule } from '@thymian/core';

export default httpRule('glob-skip-kinds-valid')
  .severity('error')
  .type('test')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();
