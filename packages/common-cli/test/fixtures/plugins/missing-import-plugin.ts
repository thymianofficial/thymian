// Fixture: imports a module that genuinely does not exist, so resolution fails with
// ERR_MODULE_NOT_FOUND (or MODULE_NOT_FOUND under CJS resolution) instead of resolving to nothing.
// A side-effect-only import: nothing after it would ever run, since the import itself throws.
import './does-not-exist.js';
