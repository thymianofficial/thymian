import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createReport, createToolRun, Thymian } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { reporterPlugin } from '../src/index.js';

/**
 * The close/flush concerns #362 raised, restated for the run-directory layout.
 *
 * The original test drove them through a per-formatter `path` that pointed at a
 * directory, so one formatter's destination failed while its siblings' worked.
 * That is no longer constructible: a formatter takes no destination, and every
 * formatter of one report resolves the same run directory. What survives the
 * change is the pair of guarantees underneath it — a destination that cannot
 * work fails the run before it starts, and a run that does start flushes every
 * formatter before it returns.
 *
 * The per-formatter in-flight failure itself is covered where it now lives:
 * get-formatters.test.ts ("still degrades an in-flight write failure instead of
 * throwing") and csv-write-failure.test.ts.
 */
describe('reporter close behavior (#362 review)', () => {
  async function fixtureReportFile(dir: string): Promise<string> {
    const reportFile = join(dir, 'input-report.json');
    await writeFile(
      reportFile,
      JSON.stringify(
        createReport([
          createToolRun({
            tool: { name: 'probe' },
            runType: 'lint',
            executions: [],
          }),
        ]),
      ),
      'utf-8',
    );

    return reportFile;
  }

  it('fails fast at registration when the reports directory cannot be used', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'reporter-close-'));
    // A plain file where the base directory has to go — the run's reports could
    // never land, and that is knowable before any workflow runs.
    const shadowed = join(dir, 'shadowed-base');
    await writeFile(shadowed, 'not a directory', 'utf-8');

    const thymian = new Thymian().register(reporterPlugin, {
      formatters: { json: {}, csv: {} },
      reportsDir: shadowed,
    });

    const start = performance.now();
    await expect(thymian.ready()).rejects.toThrow(
      /Cannot create the report output directory/,
    );

    // Fail fast: the precondition surfaces as a registration error rather than
    // stalling the action into its timeout.
    expect(performance.now() - start).toBeLessThan(5_000);
  }, 30_000);

  it('flushes every formatter into one run directory before close returns', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'reporter-close-'));
    const reportFile = await fixtureReportFile(dir);
    const reportsDir = join(dir, 'reports');

    const thymian = new Thymian().register(reporterPlugin, {
      formatters: { json: {}, csv: {}, markdown: {} },
      reportsDir,
    });

    await thymian.run(() =>
      thymian.reportConvert({
        reports: [{ type: 'thymian', location: reportFile }],
      }),
    );

    // One report, one run directory — every format of that run side by side.
    const runDirectories = await readdir(reportsDir);
    expect(runDirectories).toHaveLength(1);
    const runDirectory = join(reportsDir, runDirectories[0]!);
    expect((await readdir(runDirectory)).sort()).toEqual([
      'report.csv',
      'report.json',
      'report.md',
    ]);

    // Every flush completed, not just the one that happened to finish first:
    // core.report is dispatched without being awaited, so a write still in
    // flight when close returns would be lost to serve's process.exit.
    const written = JSON.parse(
      await readFile(join(runDirectory, 'report.json'), 'utf-8'),
    ) as { runs: unknown[] }[];
    expect(written[0]?.runs).toHaveLength(1);
  }, 30_000);
});
