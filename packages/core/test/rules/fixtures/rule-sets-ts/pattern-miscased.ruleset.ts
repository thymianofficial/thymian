// Fixture: a pattern that sweeps up a mis-cased module AND a loadable rule. The mis-cased file is
// intended code that no loader can reach, so the rule set must fail naming it (#690) rather than
// quietly running the sibling alone.
export default {
  name: 'pattern-miscased-ts',
  pattern: './miscased/**/*',
};
