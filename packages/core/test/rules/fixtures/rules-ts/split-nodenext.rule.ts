// Fixture: imports `./helper.js` while only `helper.ts` exists — the spelling
// `verbatimModuleSyntax` + NodeNext mandates in TypeScript source, and the one that makes native
// ESM answer ERR_MODULE_NOT_FOUND because the `.js` file is never emitted.
// A test fixture is loaded as a USER module, so it imports Thymian by its public package
// name exactly as a real user rule does — the shape under test. The boundary rule guards against
// core PRODUCTION code importing core by name (a circular build dependency); a fixture that is
// never compiled into the package is precisely the exception.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { constant, httpRule } from '@thymian/core';

import { helperName, helperType } from './helper.js';

export default httpRule(helperName('nodenext'))
  .severity('error')
  .type(...helperType)
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();
