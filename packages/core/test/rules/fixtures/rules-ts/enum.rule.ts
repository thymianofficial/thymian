// Fixture: a real TypeScript `enum`. This is the reproduction from the epic — an enum emits a
// runtime object, so Node's own type stripping rejects the file outright with
// ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX and nothing short of a real transform can load it.
// A test fixture is loaded as a USER module, so it imports Thymian by its public package
// name exactly as a real user rule does — the shape under test. The boundary rule guards against
// core PRODUCTION code importing core by name (a circular build dependency); a fixture that is
// never compiled into the package is precisely the exception.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { constant, httpRule } from '@thymian/core';

enum Severity {
  Error = 'error',
  Warn = 'warn',
}

export default httpRule('enum-ts')
  .severity(Severity.Error)
  .type('test', 'analytics')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();
