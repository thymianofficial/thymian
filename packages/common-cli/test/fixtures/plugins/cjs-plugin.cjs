// Fixture: plain CommonJS default export — no TypeScript, no `__esModule` marker. Proves the
// "unchanged JavaScript behaviour" claim for the population of plugins this refactor most needs
// to keep working, not just the ESM-style `.mjs` shape.
module.exports = {
  name: 'cjs-plugin',
  version: '1.0.0',
  plugin: async () => undefined,
};
