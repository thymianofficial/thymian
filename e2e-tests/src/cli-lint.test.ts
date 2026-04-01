import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  execThymian,
  fixturesDir,
  useTempDir,
} from './helpers.js';

describe('thymian lint', () => {
  const getTempDir = useTempDir();

  it('should lint an API specification and report rule violations', () => {
    copyFixturesToTempDir(join(fixturesDir, 'static-lint'), getTempDir());

    const output = execThymian(['lint'], {
      cwd: getTempDir(),
      allowFailure: true,
    });

    expect(output).toMatch(/rules run successfully/);
    expect(output).toMatch(/reported a violation/);
  }, 90_000);

  it('should accept specification via --spec flag', () => {
    copyFixturesToTempDir(join(fixturesDir, 'static-lint'), getTempDir());

    const output = execThymian(
      ['lint', '--spec', 'openapi:test.openapi.yaml'],
      { cwd: getTempDir(), allowFailure: true },
    );

    expect(output).toMatch(/rules run successfully/);
  }, 90_000);
});
