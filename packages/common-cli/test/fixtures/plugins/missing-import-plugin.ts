// Fixture: imports a module that genuinely does not exist, so resolution fails with
// ERR_MODULE_NOT_FOUND (or MODULE_NOT_FOUND under CJS resolution) instead of resolving to nothing.
import { helperName } from './does-not-exist.js';

export default {
  name: helperName('missing-import'),
  version: '1.0.0',
  plugin: async () => undefined,
};
