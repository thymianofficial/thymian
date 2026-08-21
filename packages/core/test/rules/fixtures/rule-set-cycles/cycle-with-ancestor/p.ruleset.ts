// Fixture: the entry point, deliberately NOT part of the cycle below it. `p` globs `q`, which
// globs `r`, which globs back to `q` — the loop is `q -> r -> q`, and `p` is only an ancestor.
// Regression for a real bug: reporting the FULL traversal chain (`p -> q -> r -> q`) instead of
// slicing from where the repeat actually starts would misname `p` as part of the cycle and could
// send the user to fix the wrong rule set.
export default {
  name: 'cycle-with-ancestor-p',
  pattern: './q.ruleset.ts',
};
