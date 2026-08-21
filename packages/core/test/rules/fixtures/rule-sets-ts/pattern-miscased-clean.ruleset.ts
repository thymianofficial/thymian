// Fixture: the control for `pattern-miscased`. Sweeps a loadable rule plus an upper-case
// declaration file and an upper-case JSX file; both non-modules must be dropped silently, so the
// rule set loads its one rule and throws nothing.
export default {
  name: 'pattern-miscased-clean-ts',
  pattern: './miscased-clean/**/*',
};
