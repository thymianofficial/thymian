// Fixture: a plain rule picked up by a rule-set glob. Loaded as a USER module, so it imports
// Thymian by its public package name exactly as a real user rule does.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { constant, httpRule } from '@thymian/core';

export default httpRule('diamond-shared')
  .severity('error')
  .type('test', 'analytics')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();
