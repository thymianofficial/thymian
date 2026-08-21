// Fixture: a TypeScript module with named exports only. Drives the "does not use default export"
// message, which now names the RESOLVED path rather than the specifier the user typed.
// A test fixture is loaded as a USER module, so it imports Thymian by its public package
// name exactly as a real user rule does — the shape under test. The boundary rule guards against
// core PRODUCTION code importing core by name (a circular build dependency); a fixture that is
// never compiled into the package is precisely the exception.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { constant, httpRule } from '@thymian/core';

export const rule = httpRule('no-default-ts')
  .severity('error')
  .type('test', 'analytics')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();
