// Its own glob pattern (*.rule.mjs) also matches this very file — the
// trivial self-match that must be excluded.
export default {
  name: 'glob-self-match',
  pattern: '*.rule.mjs',
};
