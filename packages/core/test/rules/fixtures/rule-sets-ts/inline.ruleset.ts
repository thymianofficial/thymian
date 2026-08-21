// Fixture: a rule set with an inline `rules` array, authored in TypeScript. The inline branch of
// `loadRuleSet` never touches the filesystem again, so this proves the rule set itself survives the
// jiti round-trip — `isRuleSet` still recognises it and its inline rules still validate.
// A test fixture is loaded as a USER module, so it imports Thymian by its public package
// name exactly as a real user rule does — the shape under test. The boundary rule guards against
// core PRODUCTION code importing core by name (a circular build dependency); a fixture that is
// never compiled into the package is precisely the exception.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { constant, httpRule, type Rule } from '@thymian/core';

const inlineRules: Rule[] = [
  httpRule('inline-ts-a')
    .severity('error')
    .type('test', 'analytics')
    .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
    .done(),
  httpRule('inline-ts-b')
    .severity('warn')
    .type('test', 'analytics')
    .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
    .done(),
];

export default {
  name: 'inline-ts',
  rules: inlineRules,
};
