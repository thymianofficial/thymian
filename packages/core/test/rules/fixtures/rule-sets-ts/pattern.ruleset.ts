// Fixture: the `pattern` branch of `loadRuleSet` — the branch that had no test coverage at all
// before this story. The glob is resolved against this file's own directory, so every match is
// re-entered through `loadRules` and must load as TypeScript.
export default {
  name: 'pattern-ts',
  pattern: './globbed/**/*.rule.ts',
};
