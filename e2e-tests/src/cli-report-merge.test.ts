import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
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
      { cwd: getTempDir() },
    );
    expect(convert.exitCode).toBe(1); // findings, not an error
    expect(existsSync(join(getTempDir(), 'converted.json'))).toBe(true);

    // Step 2: merge the persisted report WITHOUT --spec — and the fixture
    // config deliberately carries no `specifications` entry (merge still
    // resolves specs from config, ADR-0020 constrains report inputs only),
    // so endpoint resolution can only come from the format map inside
    // converted.json. Deleting the thymianFormat passthrough fails this test.
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

  it('should resolve locations per run when merged inputs carry two different format hashes (AC 3)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-merge'), getTempDir());

    // Persist two converted reports against two DIFFERENT specs — each
    // embeds its own format map under a distinct hash.
    execThymianResult(
      [
        'report',
        'convert',
        '--report',
        'spectral:spectral-findings.json',
        '--spec',
        'openapi:test.openapi.yaml',
        '-o',
        '@thymian/plugin-reporter.formatters.json.path=c1.json',
      ],
      { cwd: getTempDir() },
    );
    execThymianResult(
      [
        'report',
        'convert',
        '--report',
        'spectral:spectral-findings.json',
        '--spec',
        'openapi:test2.openapi.yaml',
        '-o',
        '@thymian/plugin-reporter.formatters.json.path=c2.json',
      ],
      { cwd: getTempDir() },
    );

    const { exitCode } = execThymianResult(
      [
        'report',
        'merge',
        '--report',
        'thymian:c1.json',
        '--report',
        'thymian:c2.json',
        '-o',
        '@thymian/plugin-reporter.formatters.markdown.path=two-hashes.md',
        '-o',
        '@thymian/plugin-reporter.formatters.json.path=two-hashes.json',
      ],
      { cwd: getTempDir() },
    );

    expect(exitCode).toBe(1);
    const merged = JSON.parse(
      readFileSync(join(getTempDir(), 'two-hashes.json'), 'utf-8'),
    ) as {
      runs: { thymianFormatVersion?: string }[];
      thymianFormat?: Record<string, unknown>;
    }[];
    // Both format maps survive the merge under distinct hashes, and each
    // run still points at its own hash.
    const hashes = Object.keys(merged[0]?.thymianFormat ?? {});
    expect(hashes).toHaveLength(2);
    expect(
      merged[0]?.runs.map((run) => run.thymianFormatVersion).sort(),
    ).toEqual([...hashes].sort());
    // Resolution goes through each run's own hash (there is no sole-entry
    // fallback). Run 1's endpoint-resolved location must still render; run
    // 2's findings keep file locations because their `source`
    // (test.openapi.yaml) matches no node loaded from test2.openapi.yaml —
    // and no location may degrade to the raw `format:<hash>` fallback text.
    const markdown = readFileSync(join(getTempDir(), 'two-hashes.md'), 'utf-8');
    expect(markdown).toContain('200 OK - */*');
    expect(markdown).not.toContain('format:');
  }, 90_000);

  it('should merge two foreign inputs (foreign+foreign pairing, AC 1)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-merge'), getTempDir());

    const { stdout, exitCode } = execThymianResult(
      [
        'report',
        'merge',
        '--report',
        'spectral:spectral-findings.json',
        '--report',
        'spectral:spectral-clean.json',
      ],
      { cwd: getTempDir() },
    );

    expect(exitCode).toBe(1);
    // Two distinct spectral inputs → two converted runs in one report.
    expect(stdout.match(/@thymian\/plugin-spectral · lint/g)?.length).toBe(2);
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
      { cwd: getTempDir() },
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
      { cwd: getTempDir() },
    );

    expect(reversed.stdout.indexOf('fixture-linter-b1')).toBeLessThan(
      reversed.stdout.indexOf('fixture-linter-a'),
    );
  }, 90_000);

  it('should treat a single input as a valid identity merge (AC 4)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-merge'), getTempDir());

    const { stdout, exitCode } = execThymianResult(
      ['report', 'merge', '--report', 'thymian:thymian-report.json'],
      { cwd: getTempDir() },
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
      { cwd: getTempDir() },
    );

    expect(exitCode).toBe(1);
    // The duplicate input collapses to a single contribution — assert on the
    // written report's structure, not on rendered-text occurrence counts.
    expect(stdout).toContain('fixture-linter-a');
    const written = JSON.parse(
      readFileSync(join(getTempDir(), '.thymian/reports/report.json'), 'utf-8'),
    ) as { runs: unknown[] }[];
    expect(written[0]?.runs).toHaveLength(1);
  }, 90_000);

  it('should ignore config-file reports — report inputs are CLI-only (ADR-0020)', () => {
    // The copied config declares `reports`, but merge never reads that key:
    // without --report the command must fail usage-style instead of
    // silently merging whatever the config names.
    copyFixturesToTempDir(join(fixturesDir, 'report-merge'), getTempDir());

    const { stderr, exitCode } = execThymianResult(['report', 'merge'], {
      cwd: getTempDir(),
    });

    expect(exitCode).toBe(2);
    expect(stderr).toContain('No report input found');
    expect(stderr).not.toContain('configuration file');
  }, 90_000);

  it('should collapse the same run arriving under two different paths to one runId (AC 4)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-merge'), getTempDir());
    // Same file content under a second path — path-keyed input identity
    // must not yield two runs with the same runId in the merged report.
    copyFileSync(
      join(getTempDir(), 'thymian-report.json'),
      join(getTempDir(), 'copy.json'),
    );

    const { exitCode } = execThymianResult(
      [
        'report',
        'merge',
        '--report',
        'thymian:thymian-report.json',
        '--report',
        'thymian:copy.json',
      ],
      { cwd: getTempDir() },
    );

    expect(exitCode).toBe(1);
    const written = JSON.parse(
      readFileSync(join(getTempDir(), '.thymian/reports/report.json'), 'utf-8'),
    ) as { runs: { runId: string }[] }[];
    expect(written[0]?.runs).toHaveLength(1);
  }, 90_000);

  it('should exit 2 when no report input is found anywhere (AC 4)', () => {
    // Deliberately no fixture copy: no config file, no flags.
    const { stderr, exitCode } = execThymianResult(['report', 'merge'], {
      cwd: getTempDir(),
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
      { cwd: getTempDir() },
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
      { cwd: getTempDir() },
    );

    expect(exitCode).toBe(2);
    expect(stderr).toContain('thymian:not-a-report.json');
    // The CLI error renderer hard-wraps stderr at terminal width with '›'
    // continuation prefixes — flatten before asserting on the message text.
    const flatStderr = stderr.replace(/\n\s*›\s*/g, ' ').replace(/\s+/g, ' ');
    expect(flatStderr).toContain('not a valid Thymian JSON report');
  }, 90_000);

  it('should exit 2 with the supported-types error for an unclaimed input type and write no report files (AC 4)', () => {
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
      { cwd: getTempDir() },
    );

    expect(exitCode).toBe(2);
    expect(stderr).toContain('"unknown-format:other.json"');
    expect(stderr).toContain('Supported report types in this run: thymian');
    // The config enables the markdown+json+csv formatters, but an unclaimed
    // input withholds the report emission — a truncated merge (only the
    // claimed input's runs) must never be persisted alongside the exit 2.
    expect(existsSync(join(getTempDir(), '.thymian/reports/report.md'))).toBe(
      false,
    );
    expect(existsSync(join(getTempDir(), '.thymian/reports/report.json'))).toBe(
      false,
    );
    expect(existsSync(join(getTempDir(), '.thymian/reports/report.csv'))).toBe(
      false,
    );
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
      { cwd: getTempDir() },
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
      // The feedback tip lands at a nondeterministic stdout position
      // between runs (#556) — this test is about the *report* output, so
      // keep the tip out of the comparison entirely.
      '--suppress-feedback',
    ];

    const first = execThymianResult(args, {
      cwd: getTempDir(),
    });
    const second = execThymianResult(args, {
      cwd: getTempDir(),
    });

    expect(first.exitCode).toBe(1);
    expect(second.exitCode).toBe(1);
    expect(normalize(first.stdout)).toBe(normalize(second.stdout));
  }, 180_000);

  it('should keep report content on stdout and operational messages off it (AC 5)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-merge'), getTempDir());

    const { stdout, stderr } = execThymianResult(
      ['report', 'merge', '--report', 'thymian:thymian-report.json'],
      { cwd: getTempDir() },
    );

    expect(stdout).toContain('Summary:');
    expect(stderr).not.toContain('Summary:');
    expect(stderr).not.toContain('fixture-linter-a');
  }, 90_000);
});
