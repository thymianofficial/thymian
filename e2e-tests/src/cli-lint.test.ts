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

    expect(output).toContain('@thymian/plugin-http-linter');
    expect(output).toContain(
      'rfc9110/origin-server-with-clock-must-generate-date-for-2xx-3xx-4xx',
    );
    expect(output).toContain(
      'Summary: 1 error(s), 0 warning(s), 0 hint(s), 0 info(s).',
    );
  }, 90_000);

  it('should accept specification via --spec flag', () => {
    copyFixturesToTempDir(join(fixturesDir, 'static-lint'), getTempDir());

    const output = execThymian(
      ['lint', '--spec', 'openapi:test.openapi.yaml'],
      { cwd: getTempDir(), allowFailure: true },
    );

    expect(output).toContain('@thymian/plugin-http-linter');
    expect(output).toContain(
      'Summary: 1 error(s), 0 warning(s), 0 hint(s), 0 info(s).',
    );
  }, 90_000);

  it('should exit with non-zero code when findings are present', () => {
    copyFixturesToTempDir(join(fixturesDir, 'static-lint'), getTempDir());

    const { exitCode } = execThymianResult(['lint'], {
      cwd: getTempDir(),
    });

    expect(exitCode).not.toBe(0);
  }, 90_000);

  it('should print a clean summary and exit 0 for a clean specification', () => {
    copyFixturesToTempDir(join(fixturesDir, 'clean-lint'), getTempDir());

    const { stdout, exitCode } = execThymianResult(['lint'], {
      cwd: getTempDir(),
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('@thymian/plugin-http-linter');
    expect(stdout).toContain(
      'Summary: 0 error(s), 0 warning(s), 0 hint(s), 0 info(s).',
    );
  }, 90_000);

  it('should output rendered report text on stdout', () => {
    copyFixturesToTempDir(join(fixturesDir, 'static-lint'), getTempDir());

    const { stdout } = execThymianResult(['lint'], {
      cwd: getTempDir(),
    });

    expect(stdout).toContain('@thymian/plugin-http-linter');
    expect(stdout).toContain('Summary:');
    expect(stdout).toContain('error(s)');
    expect(stdout).toContain('warning(s)');
    expect(stdout).toContain('hint(s)');
  }, 90_000);

  it('should use summary wording with "warning(s)"', () => {
    copyFixturesToTempDir(join(fixturesDir, 'static-lint'), getTempDir());

    const { stdout } = execThymianResult(['lint'], {
      cwd: getTempDir(),
    });

    expect(stdout).toContain('warning(s)');
    expect(stdout).not.toContain('warn(s)');
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

  it('should produce stable output structure across consecutive runs', () => {
    copyFixturesToTempDir(join(fixturesDir, 'static-lint'), getTempDir());

    const first = execThymianResult(['lint', '--suppress-feedback'], {
      cwd: getTempDir(),
    });
    const second = execThymianResult(['lint', '--suppress-feedback'], {
      cwd: getTempDir(),
    });

    const normalize = (value: string) =>
      value
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<timestamp>')
        // Real execution durations legitimately vary between runs.
        .replace(/\(\d+(?:\.\d+)?ms\)/g, '(<duration>)');

    expect(normalize(first.stdout)).toBe(normalize(second.stdout));
  }, 180_000);

  it('should separate report content (stdout) from operational messages (stderr)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'static-lint'), getTempDir());

    const { stdout, stderr } = execThymianResult(['lint'], {
      cwd: getTempDir(),
    });

    expect(stdout).toContain('Summary:');
    expect(stdout).not.toMatch(/Configuration loaded/);
    expect(typeof stderr).toBe('string');
  }, 90_000);
});
