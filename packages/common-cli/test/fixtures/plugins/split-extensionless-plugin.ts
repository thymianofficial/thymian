// Fixture: imports `./helper` with no extension. Native ESM answers ERR_MODULE_NOT_FOUND; jiti's
// extension guessing finds `helper.ts`.
import { helperName, helperVersion } from './helper';

export default {
  name: helperName('extensionless'),
  version: helperVersion,
  plugin: async () => undefined,
};
