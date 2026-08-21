// Fixture: a real rule module whose extension is UPPER-CASE on disk (#690). A `**/*` pattern sweeps
// it up alongside the loadable sibling below; it must NOT be dropped silently just because that
// sibling loads fine. Not written as a `httpRule` because it is never actually loaded — the glob
// filter refuses it first, and the refusal is the behaviour under test.
const marker = 'miscased-upper-js';

export default marker;
