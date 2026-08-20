// Fixture: a glob over JAVASCRIPT rules. Both shipped rule packages reach their rules exactly this
// way (`pattern: 'rules/**/*.rule.js'`), so this is the production shape of the branch — without it
// the loadable filter would be exercised only against TypeScript matches, and a filter accidentally
// narrowed to TypeScript would drop every built-in rule with no failing test.
export default {
  name: 'pattern-js-ts',
  pattern: './globbed-js/**/*.rule.mjs',
};
