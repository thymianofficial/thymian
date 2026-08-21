// Fixture: a mis-cased module that is the ONLY thing in its directory that could have loaded.
// Nothing survives the filter, so the pre-existing all-declined error is the better diagnosis and
// the casing throw must stand down.
const marker = 'notes-js';

export default marker;
