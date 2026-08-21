// Fixture: half of a cycle entered by TWO concurrent roots — a different defect from the one
// `cycle-a.ts` covers. There one root re-enters the loader for itself and its own evaluation chain
// catches it. Here root A evaluates this file while root B evaluates its partner, so neither chain
// contains the other's module, and only the wait-for graph can see the ring.
//
// Deliberately not reusing the `cycle-a`/`cycle-b` pair: those carry jiti registry state from
// another test, which would make this outcome depend on test order.
//
// The loader arrives through `globalThis` rather than an import — see loader-under-test.ts, which
// is the whole reason this test can fail when the fix is reverted.
//
// `fileURLToPath`, not `new URL(...).pathname`: see cycle-a.ts for the Windows drive-letter
// mangling that costs.
import { fileURLToPath } from 'node:url';

import { loaderUnderTest } from './loader-under-test.js';

export const partner = await loaderUnderTest()(
  fileURLToPath(new URL('./concurrent-cycle-a.ts', import.meta.url)),
);

export default 'concurrent-cycle-b';
