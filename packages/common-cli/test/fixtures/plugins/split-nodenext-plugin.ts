// Fixture: imports `./helper.js` while only `helper.ts` exists — the spelling
// `verbatimModuleSyntax` + NodeNext mandates in TypeScript source, and the one that makes native
// ESM answer ERR_MODULE_NOT_FOUND because the `.js` file is never emitted.
import { helperName, helperVersion } from './helper.js';

export default {
  name: helperName('nodenext'),
  version: helperVersion,
  plugin: async () => undefined,
};
