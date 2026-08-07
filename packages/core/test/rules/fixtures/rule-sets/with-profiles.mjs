import { constant, httpRule } from '@thymian/core';

// A rule set that ships named configuration profiles. Two inline rules with
// distinct shipped defaults let tests observe profile overrides applied before
// the user `rules:{}` config.
const ruleA = httpRule('profile-a')
  .severity('error')
  .type('test', 'analytics')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();

const ruleB = httpRule('profile-b')
  .severity('warn')
  .type('static', 'test', 'analytics')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();

export default {
  name: 'with-profiles',
  rules: [ruleA, ruleB],
  profiles: {
    recommended: {
      'profile-a': 'hint',
      'profile-b': { type: ['analytics', 'test'] },
    },
    strict: {},
  },
};
