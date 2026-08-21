// Fixture: one of two roots that both wait on `concurrent-shared.ts` — the shape that must NOT be
// reported as a cycle. Loader via `globalThis`; see loader-under-test.ts.
import { fileURLToPath } from 'node:url';

import { loaderUnderTest } from './loader-under-test.js';

export const shared = await loaderUnderTest()(
  fileURLToPath(new URL('./concurrent-shared.ts', import.meta.url)),
);

export default 'concurrent-dep-x';
