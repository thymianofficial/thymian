// Fixture: `module.exports = { … }` where the object is a namespace of
// named things, not the plugin itself. Node's CJS/ESM interop always sets
// `default` to `module.exports`, so `'default' in module` is true here —
// the rejection must come from `isPlugin(module.default)` failing, not from
// a missing default. Must be rejected — no default may be synthesised by
// reaching into the wrapper for a plugin-shaped nested value.
module.exports = {
  WrappedPlugin: {
    plugin: async () => undefined,
    name: 'wrapped-object-plugin',
    version: '*',
  },
};
