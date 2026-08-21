// Fixture: the TypeScript twin of `rule-sets/with-profiles.mjs`. Two inline rules with distinct
// shipped defaults let a test observe the rule set's `profiles` override applied BEFORE the user's
// `rules:{}` config — the ordering `applyProfileThenConfig` exists to guarantee.
// A test fixture is loaded as a USER module, so it imports Thymian by its public package
// name exactly as a real user rule does — the shape under test. The boundary rule guards against
// core PRODUCTION code importing core by name (a circular build dependency); a fixture that is
// never compiled into the package is precisely the exception.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { constant, httpRule, type Rule } from '@thymian/core';

const ruleA: Rule = httpRule('profile-ts-a')
  .severity('error')
  .type('test', 'analytics')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();

const ruleB: Rule = httpRule('profile-ts-b')
  .severity('warn')
  .type('static', 'test', 'analytics')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();

export default {
  name: 'with-profiles-ts',
  rules: [ruleA, ruleB],
  profiles: {
    recommended: {
      'profile-ts-a': 'hint',
      'profile-ts-b': { type: ['analytics', 'test'] },
    },
    strict: {},
  },
};
