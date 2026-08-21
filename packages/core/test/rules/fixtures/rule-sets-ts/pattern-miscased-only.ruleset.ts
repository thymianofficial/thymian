// Fixture: a pattern whose every match is declined and where one of them is mis-cased. The casing
// throw is gated on something else having loaded, so this must produce the all-declined error.
export default {
  name: 'pattern-miscased-only-ts',
  pattern: './miscased-only/**/*',
};
