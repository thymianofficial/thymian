// The actual pattern is irrelevant here — the matching test mocks tinyglobby
// to return a match that does not exist on disk (AC4: vanished between glob
// and read).
export default {
  name: 'glob-vanish',
  pattern: '*.rule.mjs',
};
