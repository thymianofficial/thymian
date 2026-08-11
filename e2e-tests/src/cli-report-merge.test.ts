import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  execThymianResult,
  fixturesDir,
  useTempDir,
} from './helpers.js';

const normalize = (value: string) =>
  value
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<timestamp>')
    .replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g, '<generated>')
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
      '<uuid>',
    )
    // Real execution durations legitimately vary between runs.
    .replace(/\(\d+(?:\.\d+)?ms\)/g, '(<duration>)');

describe('thymian report merge', () => {
  const getTempDir = useTempDir();

  it('should merge a thymian report with a converted spectral report into one rendered report and exit 1 (AC 1)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-merge'), getTempDir());

    const { stdout, exitCode } = execThymianResult(
      [
        'report',
        'merge',
        '--report',
        'thymian:thymian-report.json',
        '--report',
        'spectral:spectral-findings.json',
        '--spec',
        'openapi:test.openapi.yaml',
      ],
      { cwd: getTempDir() },
    );

    // Both source runs render in the single merged report.
    expect(stdout).toContain('fixture-linter-a');
    expect(stdout).toContain('@thymian/plugin-spectral');
    // The persisted run's severity resolves from its own rules[] (warn).
    expect(stdout).toContain('persisted warning finding');
    expect(exitCode).toBe(1);
  }, 90_000);

  it('should keep persisted format maps resolvable through a convert → persist → merge chain (AC 3)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-merge'), getTempDir());

    // Step 1: convert spectral against the spec, persisting the format map.
    const convert = execThymianResult(
      [
        'report',
        'convert',
        '--report',
        'spectral:spectral-findings.json',
        '--spec',
        'openapi:test.openapi.yaml',
        '-o',
        '@thymian/plugin-reporter.formatters.json.path=converted.json',
      ],
      { cwd: getTempDir(), allowFailure: true },
    );
    expect(convert.exitCode).toBe(1); // findings, not an error
    expect(existsSync(join(getTempDir(), 'converted.json'))).toBe(true);

    // Step 2: merge the persisted report WITHOUT --spec — endpoint
    // resolution must come from the format map inside converted.json.
    const { stdout, exitCode } = execThymianResult(
      [
        'report',
        'merge',
        '--report',
        'thymian:converted.json',
        '--report',
        'thymian:thymian-two-reports.json',
        '-o',
        '@thymian/plugin-reporter.formatters.markdown.path=merged.md',
      ],
      { cwd: getTempDir() },
    );

    expect(exitCode).toBe(1);
    // Endpoint-resolved location from the persisted format map (the same
    // assertion report-convert e2e uses to prove spec mapping worked).
    expect(stdout).toContain('200 OK - */*');
    const markdown = readFileSync(join(getTempDir(), 'merged.md'), 'utf-8');
    expect(markdown).toContain('200 OK - */*');
    expect(markdown).toContain('fixture-linter-b1');
    expect(markdown).toContain('fixture-linter-b2');
  }, 90_000);

  it('should concatenate thymian+thymian runs in input order and reverse with the flags (AC 1, 6)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-merge'), getTempDir());

    const forward = execThymianResult(
      [
        'report',
        'merge',
        '--report',
        'thymian:thymian-report.json',
        '--report',
        'thymian:thymian-two-reports.json',
      ],
      { cwd: getTempDir(), allowFailure: true },
    );

    const indexA = forward.stdout.indexOf('fixture-linter-a');
    const indexB1 = forward.stdout.indexOf('fixture-linter-b1');
    const indexB2 = forward.stdout.indexOf('fixture-linter-b2');
    expect(indexA).toBeGreaterThanOrEqual(0);
    expect(indexA).toBeLessThan(indexB1);
    expect(indexB1).toBeLessThan(indexB2);

    const reversed = execThymianResult(
      [
        'report',
        'merge',
        '--report',
        'thymian:thymian-two-reports.json',
        '--report',
        'thymian:thymian-report.json',
      ],
      { cwd: getTempDir(), allowFailure: true },
    );

    expect(reversed.stdout.indexOf('fixture-linter-b1')).toBeLessThan(
      reversed.stdout.indexOf('fixture-linter-a'),
    );
  }, 90_000);

  it('should treat a single input as a valid identity merge (AC 4)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-merge'), getTempDir());

    const { stdout, exitCode } = execThymianResult(
      ['report', 'merge', '--report', 'thymian:thymian-report.json'],
      { cwd: getTempDir(), allowFailure: true },
    );

    expect(exitCode).toBe(1);
    expect(stdout).toContain('fixture-linter-a');
    expect(stdout).toContain('Summary: 0 errors, 1 warning, 0 hints, 0 infos.');
  }, 90_000);

  it('should collapse exact duplicate inputs to a single contribution (AC 4)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-merge'), getTempDir());

    const { stdout, exitCode } = execThymianResult(
      [
        'report',
        'merge',
        '--report',
        'thymian:thymian-report.json',
        '--report',
        'thymian:thymian-report.json',
      ],
      { cwd: getTempDir(), allowFailure: true },
    );

    expect(exitCode).toBe(1);
    // The run renders exactly once — not doubled.
    expect(stdout.match(/fixture-linter-a/g)).toHaveLength(1);
  }, 90_000);

  it('should drive report merge from config-file reports when no flags are given (AC 7)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-merge'), getTempDir());

    const { stdout, exitCode } = execThymianResult(['report', 'merge'], {
      cwd: getTempDir(),
      allowFailure: true,
    });

    expect(exitCode).toBe(1);
    expect(stdout).toContain('fixture-linter-a');
    expect(stdout).toContain('@thymian/plugin-spectral');
    // The config file also enables the markdown+json formatters.
    expect(existsSync(join(getTempDir(), '.thymian/reports/report.md'))).toBe(
      true,
    );
    expect(existsSync(join(getTempDir(), '.thymian/reports/report.json'))).toBe(
      true,
    );
  }, 90_000);

  it('should exit 2 when no report input is found anywhere (AC 4)', () => {
    // Deliberately no fixture copy: no config file, no flags.
    const { stderr, exitCode } = execThymianResult(['report', 'merge'], {
      cwd: getTempDir(),
      allowFailure: true,
    });

    expect(exitCode).toBe(2);
    expect(stderr).toContain('No report input found');
  }, 90_000);

  it('should exit 2 naming the input for a malformed thymian report and write no report files (AC 2)', () => {
    // Malformed fixtures are written at runtime, never committed (they trip
    // linters).
    copyFixturesToTempDir(join(fixturesDir, 'report-merge'), getTempDir());
    writeFileSync(join(getTempDir(), 'broken.json'), '{not json', 'utf-8');

    const { stderr, exitCode } = execThymianResult(
      ['report', 'merge', '--report', 'thymian:broken.json'],
      { cwd: getTempDir(), allowFailure: true },
    );

    expect(exitCode).toBe(2);
    expect(stderr).toContain('thymian:broken.json');
    // The workflow failed before finalize — formatters must not have run.
    expect(existsSync(join(getTempDir(), '.thymian/reports/report.md'))).toBe(
      false,
    );
    expect(existsSync(join(getTempDir(), '.thymian/reports/report.json'))).toBe(
      false,
    );
  }, 90_000);

  it('should exit 2 for a valid thymian report that fails schema validation (AC 2)', () => {
    writeFileSync(
      join(getTempDir(), 'not-a-report.json'),
      JSON.stringify({ reportId: 'r-1' }),
      'utf-8',
    );

    const { stderr, exitCode } = execThymianResult(
      ['report', 'merge', '--report', 'thymian:not-a-report.json'],
      { cwd: getTempDir(), allowFailure: true },
    );

    expect(exitCode).toBe(2);
    expect(stderr).toContain('thymian:not-a-report.json');
    // The CLI error renderer hard-wraps stderr at terminal width with '›'
    // continuation prefixes — flatten before asserting on the message text.
    const flatStderr = stderr.replace(/\n\s*›\s*/g, ' ').replace(/\s+/g, ' ');
    expect(flatStderr).toContain('not a valid Thymian JSON report');
  }, 90_000);

  it('should exit 2 with the supported-types error for an unclaimed input type (AC 4)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-merge'), getTempDir());
    writeFileSync(join(getTempDir(), 'other.json'), '[]', 'utf-8');

    const { stderr, exitCode } = execThymianResult(
      [
        'report',
        'merge',
        '--report',
        'thymian:thymian-report.json',
        '--report',
        'unknown-format:other.json',
      ],
      { cwd: getTempDir(), allowFailure: true },
    );

    expect(exitCode).toBe(2);
    expect(stderr).toContain('"unknown-format:other.json"');
    expect(stderr).toContain('Supported report types in this run: thymian');
  }, 90_000);

  it('should honor an --option formatter path override (AC 5)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-merge'), getTempDir());

    execThymianResult(
      [
        'report',
        'merge',
        '--report',
        'thymian:thymian-report.json',
        '-o',
        '@thymian/plugin-reporter.formatters.markdown.path=out/custom-merged.md',
      ],
      { cwd: getTempDir(), allowFailure: true },
    );

    const markdown = readFileSync(
      join(getTempDir(), 'out/custom-merged.md'),
      'utf-8',
    );
    expect(markdown).toContain('# Thymian Report');
    expect(markdown).toContain('fixture-linter-a');
  }, 90_000);

  it('should produce deterministic output modulo timestamps, ids, and durations (AC 6)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-merge'), getTempDir());

    const args = [
      'report',
      'merge',
      '--report',
      'thymian:thymian-report.json',
      '--report',
      'thymian:thymian-two-reports.json',
    ];

    const first = execThymianResult(args, {
      cwd: getTempDir(),
      allowFailure: true,
    });
    const second = execThymianResult(args, {
      cwd: getTempDir(),
      allowFailure: true,
    });

    expect(first.exitCode).toBe(1);
    expect(second.exitCode).toBe(1);
    expect(normalize(first.stdout)).toBe(normalize(second.stdout));
  }, 180_000);

  it('should keep report content on stdout and operational messages off it (AC 5)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-merge'), getTempDir());

    const { stdout, stderr } = execThymianResult(
      ['report', 'merge', '--report', 'thymian:thymian-report.json'],
      { cwd: getTempDir(), allowFailure: true },
    );

    expect(stdout).toContain('Summary:');
    expect(stderr).not.toContain('Summary:');
    expect(stderr).not.toContain('fixture-linter-a');
  }, 90_000);
});
