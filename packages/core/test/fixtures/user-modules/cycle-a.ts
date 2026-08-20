// Fixture: re-enters the loader for its partner during its own evaluation. Left undetected this
// awaits a promise only its own return can settle, and the process hangs.
import { loadUserModule } from '../../../src/load-user-module.js';

export const partner = await loadUserModule(
  new URL('./cycle-b.ts', import.meta.url).pathname,
);

export default 'cycle-a';
