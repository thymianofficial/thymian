// A glob rule set whose pattern matches a genuinely invalid JS file — the
// whole set must fail, framed and naming the offending file (AC4).
export default {
  name: 'glob-syntax-error',
  pattern: '*.rule.mjs',
};
