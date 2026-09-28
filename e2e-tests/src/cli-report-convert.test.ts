import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  execThymianResult,
  fixturesDir,
  useTempDir,
} from './helpers.js';

describe('thymian report convert', () => {
  const getTempDir = useTempDir();

  it('should render a converted Spectral report like any workflow report and exit 1 on findings', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-convert'), getTempDir());

    const { stdout, exitCode } = execThymianResult(
      [
        'report',
        'convert',
        '--report',
        'spectral:spectral-findings.json',
        '--spec',
        'openapi:test.openapi.yaml',
      ],
      { cwd: getTempDir() },
    );

    expect(stdout).toContain('@thymian/plugin-spectral');
    expect(stdout).toContain('spectral/oas3-api-servers');
    // Findings past the operation's source position map onto format nodes
    // (best-effort spec-location mapping) and render under the endpoint
    // group — evidence the --spec payload actually reached the converter.
    expect(stdout).toContain('200 (*/*)');
    expect(stdout).toContain('Summary: 1 error, 4 warnings, 2 hints, 0 infos.');
    expect(exitCode).toBe(1);
  }, 90_000);

  it('should exit 0 for a clean converted report without any config file', () => {
    // Deliberately no fixture copy: defaultConfig autoloads the bundled
    // plugins, so this also covers the no-config-file resolution branch.
    writeFileSync(join(getTempDir(), 'spectral-clean.json'), '[]', 'utf-8');

    const { stdout, exitCode } = execThymianResult(
      ['report', 'convert', '--report', 'spectral:spectral-clean.json'],
      { cwd: getTempDir() },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain(
      'Summary: 0 errors, 0 warnings, 0 hints, 0 infos.',
    );
  }, 90_000);

  it('should exit 2 when no report input is found anywhere', () => {
    // No config file and no --report flag: the command's own usage error.
    const { exitCode, stderr } = execThymianResult(['report', 'convert'], {
      cwd: getTempDir(),
    });

    expect(exitCode).toBe(2);
    expect(stderr).toContain('No report input found');
  }, 90_000);

  it('should exit 2 for a malformed Spectral report, naming the offending input', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-convert'), getTempDir());
    // Written at runtime (not a committed fixture) so linters don't trip over
    // deliberately-invalid JSON — same approach as cli-lint's broken.yaml.
    writeFileSync(
      join(getTempDir(), 'spectral-malformed.json'),
      'not-json{{{',
      'utf-8',
    );

    const { exitCode, stderr } = execThymianResult(
      ['report', 'convert', '--report', 'spectral:spectral-malformed.json'],
      { cwd: getTempDir() },
    );

    expect(exitCode).toBe(2);
    expect(stderr).toContain('spectral:spectral-malformed.json');
  }, 90_000);

  it('should exit 2 for an unclaimed report type, naming the input', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-convert'), getTempDir());

    const { exitCode, stderr } = execThymianResult(
      ['report', 'convert', '--report', 'unknown:spectral-clean.json'],
      { cwd: getTempDir() },
    );

    expect(exitCode).toBe(2);
    expect(stderr).toContain('unknown:spectral-clean.json');
    expect(stderr).toContain('No converter plugin claimed');
  }, 90_000);

  it('should render one run per input for multiple --report and --spec inputs', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-convert'), getTempDir());

    const { stdout, exitCode } = execThymianResult(
      [
        'report',
        'convert',
        '--report',
        'spectral:spectral-findings.json',
        '--report',
        'spectral:spectral-clean.json',
        '--spec',
        'openapi:test.openapi.yaml',
        '--spec',
        'openapi:test2.openapi.yaml',
      ],
      { cwd: getTempDir() },
    );

    const runSeparators = stdout.match(/@thymian\/plugin-spectral · lint/g);
    expect(runSeparators).toHaveLength(2);
    // The union Summary proves per-input attribution: if the clean input's
    // run were dropped or duplicated from the findings input, these counts
    // would change.
    expect(stdout).toContain('Summary: 1 error, 4 warnings, 2 hints, 0 infos.');
    // The union contains findings, so the exit reflects them.
    expect(exitCode).toBe(1);
  }, 90_000);

  it('should use config-file reports when no --report flag is given', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-convert'), getTempDir());

    const { stdout, exitCode } = execThymianResult(['report', 'convert'], {
      cwd: getTempDir(),
    });

    expect(stdout).toContain('Summary: 1 error, 4 warnings, 2 hints, 0 infos.');
    expect(exitCode).toBe(1);
  }, 90_000);

  it('should let a --report flag override config-file reports', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-convert'), getTempDir());

    const { stdout, exitCode } = execThymianResult(
      ['report', 'convert', '--report', 'spectral:spectral-clean.json'],
      { cwd: getTempDir() },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain(
      'Summary: 0 errors, 0 warnings, 0 hints, 0 infos.',
    );
  }, 90_000);

  it('should write markdown and CSV file formatter output for a multi-input converted report', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-convert'), getTempDir());

    const { exitCode } = execThymianResult(
      [
        'report',
        'convert',
        '--report',
        'spectral:spectral-findings.json',
        '--report',
        'spectral:spectral-clean.json',
      ],
      { cwd: getTempDir() },
    );
    expect(exitCode).toBe(1);

    const markdownPath = join(getTempDir(), '.thymian', 'reports', 'report.md');
    const csvPath = join(getTempDir(), '.thymian', 'reports', 'report.csv');

    expect(existsSync(markdownPath)).toBe(true);
    expect(existsSync(csvPath)).toBe(true);
    expect(readFileSync(markdownPath, 'utf-8')).toContain('spectral/');
    expect(readFileSync(csvPath, 'utf-8')).toContain('spectral/');
  }, 90_000);

  it('should honor an --option formatter path override', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-convert'), getTempDir());

    const { exitCode } = execThymianResult(
      [
        'report',
        'convert',
        '--option',
        '@thymian/plugin-reporter.formatters.markdown.path=out.md',
      ],
      { cwd: getTempDir() },
    );
    expect(exitCode).toBe(1);

    const outPath = join(getTempDir(), 'out.md');
    expect(existsSync(outPath)).toBe(true);
    expect(readFileSync(outPath, 'utf-8')).toContain('spectral/');
  }, 90_000);

  it('should exit 2 for a missing report file, naming the offending input', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-convert'), getTempDir());

    const { exitCode, stderr } = execThymianResult(
      ['report', 'convert', '--report', 'spectral:does-not-exist.json'],
      { cwd: getTempDir() },
    );

    expect(exitCode).toBe(2);
    expect(stderr).toContain('spectral:does-not-exist.json');
  }, 90_000);

  it('should list supported types when some inputs are claimed and others are not', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-convert'), getTempDir());

    const { exitCode, stderr } = execThymianResult(
      [
        'report',
        'convert',
        '--report',
        'spectral:spectral-clean.json',
        '--report',
        'unknown:spectral-clean.json',
      ],
      { cwd: getTempDir() },
    );

    expect(exitCode).toBe(2);
    expect(stderr).toContain('unknown:spectral-clean.json');
    // oclif wraps stderr at terminal width with `›`-prefixed continuation
    // lines, so collapse whitespace before matching the full sentence.
    expect(stderr.replace(/[›\s]+/g, ' ')).toContain(
      'Supported report types in this run: spectral',
    );
  }, 90_000);

  it('should accept --sort-reports-by and still render the converted report', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-convert'), getTempDir());

    const { stdout, exitCode } = execThymianResult(
      ['report', 'convert', '--sort-reports-by', 'severity'],
      { cwd: getTempDir() },
    );

    expect(exitCode).toBe(1);
    expect(stdout).toContain('spectral/oas3-api-servers');
    expect(stdout).toContain('Summary: 1 error, 4 warnings, 2 hints, 0 infos.');
  }, 90_000);

  it('should produce stable output structure across consecutive runs', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-convert'), getTempDir());

    const first = execThymianResult(
      ['report', 'convert', '--suppress-feedback'],
      { cwd: getTempDir() },
    );
    const second = execThymianResult(
      ['report', 'convert', '--suppress-feedback'],
      { cwd: getTempDir() },
    );

    // Guard against a vacuous pass: two identically-failed (or empty) runs
    // would also compare equal, so pin the expected outcome first.
    expect(first.exitCode).toBe(1);
    expect(first.stdout).toContain('Summary:');

    const normalize = (value: string) =>
      value
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<timestamp>')
        // Real execution durations legitimately vary between runs.
        .replace(/\(\d+(?:\.\d+)?ms\)/g, '(<duration>)');

    expect(normalize(first.stdout)).toBe(normalize(second.stdout));
  }, 180_000);

  it('should separate report content (stdout) from operational messages (stderr)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-convert'), getTempDir());

    const { stdout, stderr } = execThymianResult(['report', 'convert'], {
      cwd: getTempDir(),
    });

    expect(stdout).toContain('Summary:');
    expect(stdout).not.toMatch(/Configuration loaded/);
    // The rendered report must not leak onto stderr.
    expect(stderr).not.toContain('Summary:');
  }, 90_000);
});
