// A glob rule set whose pattern matches a file that is matched but yields no
// rule — the set must throw rather than silently produce an empty set (AC5).
export default {
  name: 'glob-zero-rules',
  pattern: '*.mjs',
};
