// Its own glob pattern (*.rule.mjs) also matches this very file — the trivial
// self-match that AC1 requires to be excluded.
export default {
  name: 'glob-self-match',
  pattern: '*.rule.mjs',
};
