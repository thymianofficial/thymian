// Fixture: a diamond, which is NOT a cycle. Both nested rule sets point at the same rule, so a
// cumulative visited set would refuse the second, legitimate load. The chain is a stack, so both
// paths complete.
export default {
  name: 'diamond-a',
  pattern: './nested/*.ruleset.ts',
};
