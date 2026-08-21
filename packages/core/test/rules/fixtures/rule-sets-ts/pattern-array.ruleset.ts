// Fixture: the `string[]` form of `pattern`, which the glob loop handles explicitly and which no
// test covered. Mixes a TypeScript glob with a JavaScript one, so both dispatch branches run inside
// one rule set.
export default {
  name: 'pattern-array-ts',
  pattern: ['./globbed/**/*.rule.ts', './globbed-js/**/*.rule.mjs'],
};
