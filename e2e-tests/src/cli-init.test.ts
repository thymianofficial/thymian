import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { execThymian, useTempDir } from './helpers.js';

describe('thymian init', () => {
  const getTempDir = useTempDir();

  it('should initialize Thymian and create a config file', () => {
    const output = execThymian(['init', '--yes'], { cwd: getTempDir() });

    expect(output).toMatch(/Initialized Thymian/);
    expect(existsSync(join(getTempDir(), 'thymian.config.yaml'))).toBe(true);
  }, 90_000);
});
