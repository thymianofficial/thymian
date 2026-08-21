// Fixture: the second globbed rule. Sorts after `a.rule.ts`, which is what makes the load order
// assertion meaningful.
// A test fixture is loaded as a USER module, so it imports Thymian by its public package
// name exactly as a real user rule does — the shape under test. The boundary rule guards against
// core PRODUCTION code importing core by name (a circular build dependency); a fixture that is
// never compiled into the package is precisely the exception.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { constant, httpRule } from '@thymian/core';

interface Marker {
  readonly name: string;
}

const marker: Marker = { name: 'globbed-ts-b' };

export default httpRule(marker.name)
  .severity('error')
  .type('test', 'analytics')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();
