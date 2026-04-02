import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  execThymian,
  execThymianResult,
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

  it('should exit with non-zero code when findings are present', () => {
    copyFixturesToTempDir(join(fixturesDir, 'static-lint'), getTempDir());

    const { exitCode } = execThymianResult(['lint'], {
      cwd: getTempDir(),
    });

    expect(exitCode).not.toBe(0);
  }, 90_000);

  it('should print success message and exit 0 for a clean specification', () => {
    copyFixturesToTempDir(join(fixturesDir, 'clean-lint'), getTempDir());

    const { stdout, exitCode } = execThymianResult(['lint'], {
      cwd: getTempDir(),
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('No problems found');
  }, 90_000);

  it('should output report text on stdout', () => {
    copyFixturesToTempDir(join(fixturesDir, 'static-lint'), getTempDir());

    const { stdout } = execThymianResult(['lint'], {
      cwd: getTempDir(),
    });

    expect(stdout).toMatch(/errors/);
    expect(stdout).toMatch(/warnings/);
    expect(stdout).toMatch(/hints/);
  }, 90_000);

  it('should use "warning" label (not "warn") for warning-severity items', () => {
    copyFixturesToTempDir(join(fixturesDir, 'static-lint'), getTempDir());

    const { stdout } = execThymianResult(['lint'], {
      cwd: getTempDir(),
    });

    if (stdout.includes('warning')) {
      expect(stdout).not.toMatch(/⚠ warn[^i]/);
    }
  }, 90_000);
});
