import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createReport, createToolRun, Thymian } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { reporterPlugin } from '../src/index.js';

describe('reporter close behavior on a formatter failure (#362 review)', () => {
  it('fails the workflow fast and still completes the sibling flushes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'reporter-close-'));
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

    // The csv path IS a directory, so its lazy open fails (EISDIR) — the
    // "open error after init" class this PR introduced by opening on the
    // first report instead of in init().
    const jsonPath = join(dir, 'out', 'report.json');
    const thymian = new Thymian().register(reporterPlugin, {
      formatters: { csv: { path: dir }, json: { path: jsonPath } },
    });

    const start = performance.now();
    await expect(
      thymian.run(() =>
        thymian.reportConvert({
          reports: [{ type: 'thymian', location: reportFile }],
        }),
      ),
    ).rejects.toThrow(/EISDIR/);

    // Fail fast: the bad path surfaces as an error — a thrown core.close
    // handler error propagates as a correlated error event, it does not
    // stall the action into its timeout.
    expect(performance.now() - start).toBeLessThan(5_000);

    // The sibling json flush completed despite the csv failure
    // (Promise.allSettled in flushReporters, not Promise.all).
    const written = JSON.parse(await readFile(jsonPath, 'utf-8')) as {
      runs: unknown[];
    }[];
    expect(written[0]?.runs).toHaveLength(1);
  }, 30_000);
});
