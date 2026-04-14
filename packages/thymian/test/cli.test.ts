import { execSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

describe('cli', () => {
  it.each([['run'], ['dev']])(
    '%s.js can be called from any current working directory',
    async (command) => {
      expect(() =>
        // we must set NODE_ENV to NOT_TEST to avoid vitest setting it to test
        execSync(`node ../bin/${command}.js --help`, {
          stdio: 'pipe',
          cwd: dirname(fileURLToPath(import.meta.url)),
          env: { ...process.env, NODE_ENV: 'NOT_TEST' },
        }),
      ).not.toThrow();
    },
  );
});
