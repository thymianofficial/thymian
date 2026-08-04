import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  execThymian,
  execThymianRaw,
  fixturesDir,
  useTempDir,
} from './helpers.js';

describe('thymian sampler validate', () => {
  const getTempDir = useTempDir();

  it('passes when generated sampler artifacts are in sync', () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());
    execThymian(['sampler', 'init'], { cwd: getTempDir() });

    const result = execThymianRaw(['sampler', 'validate'], {
      cwd: getTempDir(),
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toMatch(
      /Sampler validation passed: \d+ generated artifacts are in sync\./,
    );
  }, 180_000);

  it('fails with file-specific diagnostics when generated artifacts drift', () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());
    execThymian(['sampler', 'init'], { cwd: getTempDir() });

    writeFileSync(
      join(getTempDir(), '.thymian', 'samples', 'types.d.ts'),
      'changed',
    );

    const result = execThymianRaw(['sampler', 'validate'], {
      cwd: getTempDir(),
      allowFailure: true,
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('changed-artifact: types.d.ts');
    expect(result.output).toMatch(
      /Checked \d+ generated artifacts in .+\. \d+ out of sync\./,
    );
    expect(result.output).not.toContain('sampler init');
    expect(result.output).not.toContain('Re-run:');
    expect(result.output).not.toContain('--overwrite');
  }, 180_000);

  it('reports missing and unexpected generated artifacts', () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());
    execThymian(['sampler', 'init'], { cwd: getTempDir() });

    unlinkSync(join(getTempDir(), '.thymian', 'samples', 'tsconfig.json'));
    writeFileSync(
      join(getTempDir(), '.thymian', 'samples', 'orphan.json'),
      '{}',
    );

    const result = execThymianRaw(['sampler', 'validate'], {
      cwd: getTempDir(),
      allowFailure: true,
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('missing-artifact: tsconfig.json');
    expect(result.output).toContain('unexpected-artifact: orphan.json');
  }, 180_000);

  it('reports additional sample tree elements without loading stale metadata', () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());
    execThymian(['sampler', 'init'], { cwd: getTempDir() });

    const unexpectedDir = join(
      getTempDir(),
      '.thymian',
      'samples',
      'new-source',
      'new-path',
    );
    mkdirSync(unexpectedDir, { recursive: true });
    writeFileSync(join(unexpectedDir, 'new-sample.json'), '{}');

    const result = execThymianRaw(['sampler', 'validate'], {
      cwd: getTempDir(),
      allowFailure: true,
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(
      'unexpected-artifact: new-source/new-path/new-sample.json',
    );
    expect(result.output).not.toContain('Unknown type:');
  }, 180_000);

  it('summarizes without diffs by default and shows them with --full-diffs', () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());
    execThymian(['sampler', 'init'], { cwd: getTempDir() });

    const metaPath = join(getTempDir(), '.thymian', 'samples', 'meta.json');
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    meta.version.version = 'old-format-hash';
    writeFileSync(metaPath, JSON.stringify(meta));

    const summary = execThymianRaw(['sampler', 'validate'], {
      cwd: getTempDir(),
      allowFailure: true,
    });

    expect(summary.exitCode).toBe(1);
    expect(summary.output).toContain('stale-root-metadata: meta.json');
    // The default output lists the artifact but not the per-change diff.
    expect(summary.output).not.toContain('JSON changes:');

    const detailed = execThymianRaw(['sampler', 'validate', '--full-diffs'], {
      cwd: getTempDir(),
      allowFailure: true,
    });

    expect(detailed.exitCode).toBe(1);
    expect(detailed.output).toContain('stale-root-metadata: meta.json');
    expect(detailed.output).toContain('JSON changes:');
    expect(detailed.output).toContain('[update] /version/version');
    expect(detailed.output).toContain('"old-format-hash"');
  }, 180_000);

  it('validates a single artifact with --for-path', () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());
    execThymian(['sampler', 'init'], { cwd: getTempDir() });

    const metaPath = join(getTempDir(), '.thymian', 'samples', 'meta.json');
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    meta.version.version = 'old-format-hash';
    writeFileSync(metaPath, JSON.stringify(meta));

    // A different artifact is broken too, but --for-path scopes to meta.json.
    writeFileSync(
      join(getTempDir(), '.thymian', 'samples', 'types.d.ts'),
      'changed',
    );

    const result = execThymianRaw(
      ['sampler', 'validate', '--for-path', 'meta.json'],
      { cwd: getTempDir(), allowFailure: true },
    );

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('stale-root-metadata: meta.json');
    expect(result.output).toContain('[update] /version/version');
    expect(result.output).not.toContain('types.d.ts');
    expect(result.output).toContain('Checked 1 generated artifact ');
  }, 180_000);

  it('errors when --for-path targets an unknown artifact', () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());
    execThymian(['sampler', 'init'], { cwd: getTempDir() });

    const result = execThymianRaw(
      ['sampler', 'validate', '--for-path', 'does-not-exist.json'],
      { cwd: getTempDir(), allowFailure: true },
    );

    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('does-not-exist.json');
  }, 180_000);

  it('emits a JSON report and exit 2 when --json --for-path targets an unknown artifact', () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());
    execThymian(['sampler', 'init'], { cwd: getTempDir() });

    const result = execThymianRaw(
      ['sampler', 'validate', '--json', '--for-path', 'does-not-exist.json'],
      { cwd: getTempDir(), allowFailure: true },
    );

    expect(result.exitCode).toBe(2);

    const report = JSON.parse(result.stdout);
    expect(report.checkedArtifacts).toBe(0);
    expect(report.failures).toEqual([]);
  }, 180_000);

  it('emits a machine-readable report and non-zero exit with --json', () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());
    execThymian(['sampler', 'init'], { cwd: getTempDir() });

    writeFileSync(
      join(getTempDir(), '.thymian', 'samples', 'types.d.ts'),
      'changed',
    );

    const result = execThymianRaw(['sampler', 'validate', '--json'], {
      cwd: getTempDir(),
      allowFailure: true,
    });

    expect(result.exitCode).toBe(1);

    const report = JSON.parse(result.stdout);
    expect(report.checkedArtifacts).toBeGreaterThan(0);
    expect(
      report.failures.some(
        (failure: { type: string; path: string }) =>
          failure.type === 'changed-artifact' && failure.path === 'types.d.ts',
      ),
    ).toBe(true);
  }, 180_000);

  it('exits zero and prints a JSON report with --json when in sync', () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());
    execThymian(['sampler', 'init'], { cwd: getTempDir() });

    const result = execThymianRaw(['sampler', 'validate', '--json'], {
      cwd: getTempDir(),
    });

    expect(result.exitCode).toBe(0);

    const report = JSON.parse(result.stdout);
    expect(report.failures).toEqual([]);
  }, 180_000);

  it('renders full content with --full-diffs', () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());
    execThymian(['sampler', 'init'], { cwd: getTempDir() });

    writeFileSync(
      join(getTempDir(), '.thymian', 'samples', 'types.d.ts'),
      'first line\nsecond line\n',
    );

    const result = execThymianRaw(['sampler', 'validate', '--full-diffs'], {
      cwd: getTempDir(),
      allowFailure: true,
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('changed-artifact: types.d.ts');
    expect(result.output).toContain('second line');
    // The full expected content is shown, including a type that appears well
    // into the generated file.
    expect(result.output).toContain('HttpRequestTemplate');
  }, 180_000);

  it('ignores user hook files in the samples directory', () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());
    execThymian(['sampler', 'init'], { cwd: getTempDir() });
    writeFileSync(
      join(getTempDir(), '.thymian', 'samples', 'custom.beforeEach.ts'),
      'export default async function beforeEach() {}',
    );

    const result = execThymianRaw(['sampler', 'validate'], {
      cwd: getTempDir(),
    });

    expect(result.exitCode).toBe(0);
  }, 180_000);

  it('validates a custom sampler path from plugin options', () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());
    const configPath = join(getTempDir(), 'thymian.config.yaml');
    const config = readFileSync(configPath, 'utf8').replace(
      "'@thymian/plugin-sampler': {}",
      "'@thymian/plugin-sampler':\n    options:\n      path: custom-samples",
    );
    writeFileSync(configPath, config);

    execThymian(['sampler', 'init'], { cwd: getTempDir() });

    const result = execThymianRaw(['sampler', 'validate'], {
      cwd: getTempDir(),
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toMatch(
      /Sampler validation passed: \d+ generated artifacts are in sync\./,
    );
  }, 180_000);
});
