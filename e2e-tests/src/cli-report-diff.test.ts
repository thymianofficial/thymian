import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  execThymianResult,
  fixturesDir,
  useTempDir,
} from './helpers.js';

interface DiffDocument {
  diffId: string;
  createdAt: string;
  baseReportId: string;
  headReportId: string;
  baseCreatedAt: string;
  headCreatedAt: string;
  changes: {
    kind: string;
    change: string;
    changedAspects?: string[];
    endpoint?: string;
    severity?: string;
    reason?: string;
  }[];
}

describe('thymian report diff', () => {
  const getTempDir = useTempDir();

  it('diffs a report against itself (two path spellings) to an empty diff and exit 0 (AC 1)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-diff'), getTempDir());

    // Deliberately different spellings of the same file: input identity is
    // string-only upstream, but per-side loading must still yield an empty
    // diff (Dev Notes hazard test).
    const { stdout, exitCode } = execThymianResult(
      [
        'report',
        'diff',
        '--base',
        'thymian:./base-report.json',
        '--head',
        'thymian:base-report.json',
      ],
      { cwd: getTempDir() },
    );

    expect(stdout).toContain('No changes between base and head.');
    expect(exitCode).toBe(0);
  }, 90_000);

  it('reports an improvements-only diff as an improvement and exits 0 (AC 7, 8)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-diff'), getTempDir());

    const { stdout, exitCode } = execThymianResult(
      [
        'report',
        'diff',
        '--base',
        'thymian:base-report.json',
        '--head',
        'thymian:head-improved.json',
      ],
      { cwd: getTempDir() },
    );

    expect(stdout).toContain('Run results    0 new · 1 resolved');
    expect(stdout).toContain(
      'Improvement: 1 run result(s) resolved, none added.',
    );
    expect(stdout).toContain('(resolved)');
    expect(exitCode).toBe(0);
  }, 90_000);

  it('reports a regression informationally by default and gates only via --fail-on (AC 7)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-diff'), getTempDir());
    const args = [
      'report',
      'diff',
      '--base',
      'thymian:base-report.json',
      '--head',
      'thymian:head-regressed.json',
    ];

    // Default is informational: the regression is reported but exits 0.
    const informational = execThymianResult(args, { cwd: getTempDir() });
    expect(informational.stdout).toContain('Run results    1 new · 0 resolved');
    expect(informational.stdout).toContain('regression');
    expect(informational.exitCode).toBe(0);

    // Opting into the gate fails the same diff.
    const regression = execThymianResult([...args, '--fail-on', 'regression'], {
      cwd: getTempDir(),
    });
    expect(regression.exitCode).toBe(1);

    // The new failure is warn-severity: the error-only gate lets it pass.
    const errorOnly = execThymianResult([...args, '--fail-on', 'error'], {
      cwd: getTempDir(),
    });
    expect(errorOnly.exitCode).toBe(0);
  }, 180_000);

  it('emits the machine-readable diff document with --json (AC 3)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-diff'), getTempDir());

    const { stdout, exitCode } = execThymianResult(
      [
        'report',
        'diff',
        '--base',
        'thymian:base-report.json',
        '--head',
        'thymian:head-regressed.json',
        '--fail-on',
        'none',
        '--json',
        // The feedback tip races report rendering (#556) and would corrupt
        // the parsed stdout.
        '--suppress-feedback',
      ],
      { cwd: getTempDir() },
    );

    expect(exitCode).toBe(0);
    const diff = JSON.parse(stdout) as DiffDocument;
    expect(diff.baseReportId).toBe('aaaaaaaa-1111-4111-8111-111111111111');
    expect(diff.headReportId).toBe('eeeeeeee-5555-4555-8555-555555555555');
    expect(diff.baseCreatedAt).toBe('2026-08-10T10:00:00.000Z');
    expect(diff.headCreatedAt).toBe('2026-08-20T11:00:00.000Z');
    expect(diff.changes).toEqual([
      expect.objectContaining({
        kind: 'run-result',
        change: 'added',
        severity: 'warn',
        reason: 'brand new soft failure',
      }),
    ]);
  }, 90_000);

  it('detects specification changes across two lint reports with different format hashes (AC 5, 9)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-diff'), getTempDir());

    // Produce two real reports against two versions of the same API — the
    // embedded format graphs carry DIFFERENT hashes (#507 never exercised
    // this e2e). Lint exits 1 (strict profile finding); that's expected.
    for (const [spec, out] of [
      ['api-v1.openapi.yaml', 'r1.json'],
      ['api-v2.openapi.yaml', 'r2.json'],
    ] as const) {
      const lint = execThymianResult(
        [
          'lint',
          '--spec',
          `openapi:${spec}`,
          '-o',
          `@thymian/plugin-reporter.formatters.json.path=${out}`,
        ],
        { cwd: getTempDir() },
      );
      expect(existsSync(join(getTempDir(), out))).toBe(true);
      expect([0, 1]).toContain(lint.exitCode);
    }

    const { stdout, exitCode } = execThymianResult(
      [
        'report',
        'diff',
        '--base',
        'thymian:r1.json',
        '--head',
        'thymian:r2.json',
        '--fail-on',
        'none',
        '--json',
        // The feedback tip races report rendering (#556) and would corrupt
        // the parsed stdout.
        '--suppress-feedback',
      ],
      { cwd: getTempDir() },
    );

    expect(exitCode).toBe(0);
    const diff = JSON.parse(stdout) as DiffDocument;
    const specification = diff.changes.filter(
      (change) => change.kind === 'specification',
    );
    expect(specification).toEqual([
      expect.objectContaining({
        change: 'changed',
        endpoint: 'GET /api/hello',
        changedAspects: expect.arrayContaining(['queryParameters']),
      }),
    ]);
    // Endpoint pairing keeps the identical lint finding on the changed
    // endpoint out of the run-result changes.
    expect(
      diff.changes.filter((change) => change.kind === 'run-result'),
    ).toEqual([]);
  }, 180_000);

  it('rejects non-thymian typed inputs with a usage error naming the restriction (AC 2)', () => {
    copyFixturesToTempDir(join(fixturesDir, 'report-diff'), getTempDir());

    const { stderr, exitCode } = execThymianResult(
      [
        'report',
        'diff',
        '--base',
        'spectral:base-report.json',
        '--head',
        'thymian:base-report.json',
      ],
      { cwd: getTempDir() },
    );

    expect(exitCode).toBe(2);
    // The CLI error renderer hard-wraps stderr, so match wrap-tolerantly.
    expect(stderr.replaceAll(/\s+/g, ' ')).toContain(
      'Unsupported report type "spectral" for --base',
    );
  }, 90_000);
});
