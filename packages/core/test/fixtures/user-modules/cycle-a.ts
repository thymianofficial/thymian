// Fixture: re-enters the loader for its partner during its own evaluation. Left undetected this
// awaits a promise only its own return can settle, and the process hangs.
//
// `fileURLToPath`, not `new URL(...).pathname`: a URL pathname is not a filesystem path. It is
// percent-encoded everywhere, and on Windows it carries a leading slash before the drive letter
// (`/D:/…`) — which `path.isAbsolute` accepts, `realpathSync.native` then rejects, and
// `canonicalise`'s `path.resolve` fallback re-anchors on the current drive as `D:\D:\…`. The
// evaluation chain misses, jiti throws a raw MODULE_NOT_FOUND, and this fixture proves nothing.
// Observed on all three windows-2022 legs of the CI matrix.
import { fileURLToPath } from 'node:url';

import { loadUserModule } from '../../../src/load-user-module.js';

export const partner = await loadUserModule(
  fileURLToPath(new URL('./cycle-b.ts', import.meta.url)),
);

export default 'cycle-a';
