import { constant } from '@thymian/core';

import { httpRule } from '../../../src/index.js';

export default httpRule('b')
  .severity('warn')
  .type('test')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();
