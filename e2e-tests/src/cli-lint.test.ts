import { writeFileSync } from 'node:fs';
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

    expect(stdout).toContain('warning');
    expect(stdout).not.toMatch(/⚠ warn[^i]/);
  }, 90_000);

  it('should exit with code 2 for an invalid (unparseable) spec', () => {
    const tempDir = getTempDir();
    writeFileSync(
      join(tempDir, 'broken.yaml'),
      '{{not: valid yaml at all',
      'utf-8',
    );

    const { exitCode, stderr } = execThymianResult(
      ['lint', '--spec', 'openapi:broken.yaml'],
      { cwd: tempDir },
    );

    expect(exitCode).toBe(2);
    expect(stderr).toMatch(/error/i);
  }, 90_000);

  it('should produce deterministic output across consecutive runs', () => {
    copyFixturesToTempDir(join(fixturesDir, 'static-lint'), getTempDir());

    const first = execThymianResult(['lint'], { cwd: getTempDir() });
    const second = execThymianResult(['lint'], { cwd: getTempDir() });

    expect(first.stdout).toBe(second.stdout);
  }, 180_000);

  it('should separate report content (stdout) from operational messages (stderr)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'static-lint'), getTempDir());

    const { stdout, stderr } = execThymianResult(['lint'], {
      cwd: getTempDir(),
    });

    // Report content should be on stdout
    expect(stdout).toMatch(/errors/);
    expect(stdout).toMatch(/hints/);

    // Operational messages (e.g. logs, warnings) should not leak into stdout
    // stdout should only contain the formatted report
    expect(stdout).not.toMatch(/Configuration loaded/);

    // stderr should be a string (operational output goes here, if any)
    expect(typeof stderr).toBe('string');
  }, 90_000);
});
