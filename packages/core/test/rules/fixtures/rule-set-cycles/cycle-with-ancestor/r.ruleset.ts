// Fixture: the other half of the actual cycle — points back at `q`, not at `p`. The closed loop
// is `q -> r -> q`; `p` must not appear in the reported ring.
export default {
  name: 'cycle-with-ancestor-r',
  pattern: './q.ruleset.ts',
};
