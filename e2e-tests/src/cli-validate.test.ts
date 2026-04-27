import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  execThymianResult,
  fixturesDir,
  useTempDir,
} from './helpers.js';

describe('thymian validate', () => {
  const getTempDir = useTempDir();

  it('validates a spec passed via --spec', () => {
    copyFixturesToTempDir(join(fixturesDir, 'clean-lint'), getTempDir());

    const { stdout, exitCode } = execThymianResult(
      ['validate', '--spec', 'openapi:test.openapi.yaml'],
      {
        cwd: getTempDir(),
      },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain('✓ test.openapi.yaml');
  }, 90_000);

  it('fails for invalid OpenAPI specs', () => {
    const tempDir = getTempDir();
    writeFileSync(
      join(tempDir, 'broken.yaml'),
      ['openapi: 3.1.0', 'info:', '  version: 1.0.0', 'paths: {}'].join('\n'),
      'utf-8',
    );

    const { stdout, exitCode } = execThymianResult(
      ['validate', '--spec', 'openapi:broken.yaml'],
      {
        cwd: tempDir,
      },
    );

    expect(exitCode).toBe(1);
    expect(stdout).toContain('1 of 1');
    expect(stdout).toContain('✖ broken.yaml');
  }, 90_000);

  it('fails for unsupported specification types instead of reporting success', () => {
    const tempDir = getTempDir();
    writeFileSync(
      join(tempDir, 'asyncapi.yaml'),
      ['asyncapi: 3.0.0', 'info:', '  title: Test', '  version: 1.0.0'].join(
        '\n',
      ),
      'utf-8',
    );

    const { stdout, exitCode } = execThymianResult(
      ['validate', '--spec', 'asyncapi:asyncapi.yaml'],
      {
        cwd: tempDir,
      },
    );

    expect(exitCode).toBe(2);
    expect(stdout).not.toContain('All specifications are valid.');
    expect(stdout).toContain('could not be validated');
  }, 90_000);
});
