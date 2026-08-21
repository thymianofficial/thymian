// Fixture: the same loadable sibling as `miscased/`, in a directory with NO mis-cased module. Its
// counterpart proves the fatal path fires; this one proves the sibling genuinely loads, so neither
// fatal test can pass with a broken or missing sibling.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { constant, httpRule } from '@thymian/core';

export default httpRule('miscased-clean-sibling')
  .severity('error')
  .type('test', 'analytics')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();
