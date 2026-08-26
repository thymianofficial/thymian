import { fileURLToPath } from 'node:url';

import { captureOutput } from '@oclif/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.OCLIF_TEST_ROOT = fileURLToPath(
  new URL('../../..', import.meta.url),
);

vi.mock('@thymian/core', async () =>
  (await import('../../helpers/mock-thymian.js')).mockThymianCore(),
);

import { createReportDiff } from '@thymian/core';

import ReportDiff from '../../../src/commands/report/diff.js';
import { mockState, resetMockState } from '../../helpers/mock-thymian.js';

// The parse rule (first-colon split) and the gate/summary logic are covered
// by common-cli's unit tests — this file asserts what is specific to
// `report diff`: flag wiring, the Thymian-only type restriction at the
// command boundary, and the --fail-on exit-code mapping (#502).
function regressionDiff() {
  return createReportDiff(
    { reportId: 'base-r', createdAt: '2026-01-01T00:00:00.000Z' },
    { reportId: 'head-r', createdAt: '2026-01-02T00:00:00.000Z' },
    [
      {
        kind: 'run-result',
        change: 'added',
        runType: 'lint',
        severity: 'warn',
        ruleId: 'rfc9110/x',
      },
    ],
  );
}

describe('report diff command', () => {
  beforeEach(() => {
    resetMockState();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('forwards --base and --head through the run lifecycle and prints the summary (AC 1, 8)', async () => {
    const { stdout, error } = await captureOutput(async () => {
      await ReportDiff.run([
        '--base',
        'thymian:./before.json',
        '--head',
        'thymian:./after.json',
        '--no-autoload',
      ]);
    });

    expect(error).toBeUndefined();
    expect(mockState.runCalled).toBe(true);
    expect(mockState.reportDiffInput).toEqual({
      base: { type: 'thymian', location: './before.json' },
      head: { type: 'thymian', location: './after.json' },
    });
    expect(stdout).toContain('Report diff: base mock-base');
    expect(stdout).toContain('No changes between base and head.');
  });

  it('rejects a non-thymian input type with a usage error naming the restriction (AC 2)', async () => {
    const { error } = await captureOutput(async () => {
      await ReportDiff.run([
        '--base',
        'spectral:./before.json',
        '--head',
        'thymian:./after.json',
        '--no-autoload',
      ]);
    });

    expect(error?.message).toContain(
      'Unsupported report type "spectral" for --base',
    );
    expect(error?.message).toContain('only "thymian" reports can be diffed');
    expect(
      (error as { oclif?: { exit?: number } } | undefined)?.oclif?.exit,
    ).toBe(2);
    expect(mockState.runCalled).toBeFalsy();
  });

  it('fails with a usage error when --base or --head is missing (AC 2)', async () => {
    const { error } = await captureOutput(async () => {
      await ReportDiff.run([
        '--base',
        'thymian:./before.json',
        '--no-autoload',
      ]);
    });

    expect(error?.message).toContain('head');
  });

  it('exits 1 on a regression under the default --fail-on regression (AC 7)', async () => {
    mockState.reportDiffResult = { diff: regressionDiff(), unclaimed: [] };

    const { error } = await captureOutput(async () => {
      await ReportDiff.run([
        '--base',
        'thymian:./before.json',
        '--head',
        'thymian:./after.json',
        '--no-autoload',
      ]);
    });

    expect(
      (error as { oclif?: { exit?: number } } | undefined)?.oclif?.exit,
    ).toBe(1);
  });

  it('exits 0 for the same regression under --fail-on none (AC 7)', async () => {
    mockState.reportDiffResult = { diff: regressionDiff(), unclaimed: [] };

    const { error, stdout } = await captureOutput(async () => {
      await ReportDiff.run([
        '--base',
        'thymian:./before.json',
        '--head',
        'thymian:./after.json',
        '--fail-on',
        'none',
        '--no-autoload',
      ]);
    });

    expect(error).toBeUndefined();
    expect(stdout).toContain('1 new run result(s) — regression');
  });

  it('prints the machine-readable diff document with --json (AC 3)', async () => {
    mockState.reportDiffResult = { diff: regressionDiff(), unclaimed: [] };

    const { stdout, error } = await captureOutput(async () => {
      await ReportDiff.run([
        '--base',
        'thymian:./before.json',
        '--head',
        'thymian:./after.json',
        '--fail-on',
        'none',
        '--json',
        '--no-autoload',
      ]);
    });

    expect(error).toBeUndefined();
    const parsed = JSON.parse(stdout) as {
      baseReportId: string;
      changes: unknown[];
    };
    expect(parsed.baseReportId).toBe('base-r');
    expect(parsed.changes).toHaveLength(1);
  });

  it('fails usage-style when an input goes unclaimed (AC 1)', async () => {
    mockState.reportDiffResult = {
      unclaimed: [{ type: 'thymian', location: './before.json' }],
    };

    const { error } = await captureOutput(async () => {
      await ReportDiff.run([
        '--base',
        'thymian:./before.json',
        '--head',
        'thymian:./after.json',
        '--no-autoload',
      ]);
    });

    // The head input's claim makes the `thymian` type "supported", so the
    // per-input variant of the enforcement wording applies.
    expect(error?.message).toContain(
      'has a supported type but was not claimed',
    );
    expect(
      (error as { oclif?: { exit?: number } } | undefined)?.oclif?.exit,
    ).toBe(2);
  });
});
