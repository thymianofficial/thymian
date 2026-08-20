// Fixture: `export =` with an OBJECT — the natural rule-set shape, and the case the wrap in
// `importThroughJiti` deliberately does NOT cover. Through jiti's proxy this is indistinguishable
// from a module with only named exports, so it must surface as "no default export" rather than be
// guessed at. Its sibling `primitive.cts` covers the case that IS wrapped.
export = { name: 'object-export' };
