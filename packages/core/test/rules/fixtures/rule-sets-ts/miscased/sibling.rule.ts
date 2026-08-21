// Fixture: the perfectly loadable sibling. Its presence is the point — it means the rule set has a
// rule to run, so a silently dropped mis-cased module would leave the set looking healthy.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { constant, httpRule } from '@thymian/core';

export default httpRule('miscased-sibling')
  .severity('error')
  .type('test', 'analytics')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();
