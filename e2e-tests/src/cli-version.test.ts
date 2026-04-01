import { describe, expect, it } from 'vitest';

import { execThymian, useTempDir } from './helpers.js';

describe('thymian version', () => {
  const getTempDir = useTempDir();

  it('should print version information when invoked without arguments', () => {
    const output = execThymian([], { cwd: getTempDir() });

    expect(output).toMatch(/VERSION/);
  }, 90_000);
});
