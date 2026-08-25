// Increments a global counter at module top-level so a test can assert the
// module body ran exactly once, even when reached via two different path
// spellings concurrently (AC6). `counter-link.rule.mjs` is a symlink to this
// file, so the two spellings share this file's realpath but are literally
// different strings — proving our own canonicalise-once cache, not just
// relying on Node's native import() cache (which is keyed by exact URL).
globalThis.__resolverSeamCounterRuns =
  (globalThis.__resolverSeamCounterRuns ?? 0) + 1;

export default {
  meta: {
    name: 'counter',
    severity: 'off',
    type: [],
    tags: [],
    options: {},
  },
};
