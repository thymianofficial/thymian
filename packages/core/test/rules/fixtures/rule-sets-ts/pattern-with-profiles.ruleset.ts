// Fixture: a rule set that has BOTH a `pattern` and `profiles`. The glob loop forwards
// `profileConfig` into its recursion, so a profile override must reach a globbed rule — stated as a
// requirement in the story's Dev Notes and otherwise untested, because every other profile fixture
// uses an inline `rules` array.
export default {
  name: 'pattern-with-profiles-ts',
  pattern: './globbed/**/*.rule.ts',
  profiles: {
    recommended: {
      'globbed-ts-a': 'hint',
    },
    strict: {},
  },
};
