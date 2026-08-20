// Fixture: imports `./helper` with no extension. Native ESM answers ERR_MODULE_NOT_FOUND; jiti's
// extension guessing finds `helper.ts`.
// A test fixture is loaded as a USER module, so it imports Thymian by its public package
// name exactly as a real user rule does — the shape under test. The boundary rule guards against
// core PRODUCTION code importing core by name (a circular build dependency); a fixture that is
// never compiled into the package is precisely the exception.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { constant, httpRule } from '@thymian/core';

import { helperName, helperType } from './helper';

export default httpRule(helperName('extensionless'))
  .severity('error')
  .type(...helperType)
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();
