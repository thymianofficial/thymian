import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { execThymian, useTempDir } from './helpers.js';

describe('thymian generate config', () => {
  const getTempDir = useTempDir();

  it('should generate a config file for a given spec', () => {
    const output = execThymian(
      [
        'generate',
        'config',
        '--no-interactive',
        '--for-spec',
        'openapi:petstore.yaml',
      ],
      { cwd: getTempDir() },
    );

    expect(output).toMatch(/Configuration written to/);
    expect(existsSync(join(getTempDir(), 'thymian.config.yaml'))).toBe(true);
  }, 90_000);
});
