// Fixture: the other half of the cycle.
import { loadUserModule } from '../../../src/load-user-module.js';

export const partner = await loadUserModule(
  new URL('./cycle-a.ts', import.meta.url).pathname,
);

export default 'cycle-b';
