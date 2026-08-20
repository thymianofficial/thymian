// Fixture: the other half of the cycle. See cycle-a.ts for why this is `fileURLToPath` rather
// than `new URL(...).pathname`.
import { fileURLToPath } from 'node:url';

import { loadUserModule } from '../../../src/load-user-module.js';

export const partner = await loadUserModule(
  fileURLToPath(new URL('./cycle-a.ts', import.meta.url)),
);

export default 'cycle-b';
