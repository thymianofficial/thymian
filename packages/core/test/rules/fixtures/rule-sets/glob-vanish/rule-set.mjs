// The actual pattern is irrelevant here — the matching test mocks tinyglobby
// to return a match that does not exist on disk (a file that vanished
// between the glob call and the load attempt).
export default {
  name: 'glob-vanish',
  pattern: '*.rule.mjs',
};
