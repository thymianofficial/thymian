// Fixture: `export =` with a primitive. CommonJS TypeScript can export a bare value, which has
// no namespace to search — so a caller doing `'default' in module` needs it wrapped.
export = 'primitive-cts';
