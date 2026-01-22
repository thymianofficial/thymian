import { execSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

describe('cli', { timeout: 10000 }, () => {
  it.each([['run'], ['dev']])(
    '%s.js can be called from any current working directory',
    async (command) => {
      expect(() =>
        execSync(`../bin/${command}.js http-linter:overview`, {
          stdio: 'pipe',
          cwd: dirname(fileURLToPath(import.meta.url)),
        }),
      ).not.toThrow();
    },
  );
});
