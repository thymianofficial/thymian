// Loaded by load-rule.mjs through the installed, built @thymian/core — not
// through this monorepo's source tree, and not through vitest's own
// transform pipeline (the harness runs as a plain `node` subprocess).
export default {
  meta: {
    name: 'external-harness-ts-rule',
    severity: 'error' as const,
    type: ['informational'],
    tags: [],
    options: {},
  },
};
