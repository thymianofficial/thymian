import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Report } from '../src/index.js';
import {
  createLintExecution,
  createReport,
  createToolRun,
  loadThymianReports,
  ThymianBaseError,
} from '../src/index.js';

function sampleReport(toolName = 'sample-tool'): Report {
  const run = createToolRun({
    tool: { name: toolName },
    runType: 'lint',
    executions: [
      createLintExecution({
        location: { type: 'custom', value: 'check-0' },
        ruleId: 'example/rule',
        status: { kind: 'failed', reason: 'persisted finding' },
      }),
    ],
  });

  return createReport([run]);
}

describe('loadThymianReports', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'load-thymian-report-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function writeReportFile(
    name: string,
    content: unknown,
  ): Promise<string> {
    const filePath = join(tmpDir, name);
    await writeFile(
      filePath,
      typeof content === 'string' ? content : JSON.stringify(content),
      'utf-8',
    );
    return filePath;
  }

  it('accepts a bare single report object', async () => {
    const source = sampleReport('bare-tool');
    const reportFile = await writeReportFile('bare.json', source);

    const reports = await loadThymianReports(
      reportFile,
      `thymian:${reportFile}`,
      tmpDir,
    );

    expect(reports).toHaveLength(1);
    expect(reports[0]?.reportId).toBe(source.reportId);
  });

  it('accepts an array of reports and returns every one', async () => {
    const first = sampleReport('array-tool-a');
    const second = sampleReport('array-tool-b');
    const reportFile = await writeReportFile('array.json', [first, second]);

    const reports = await loadThymianReports(
      reportFile,
      `thymian:${reportFile}`,
      tmpDir,
    );

    expect(reports.map((report) => report.reportId)).toEqual([
      first.reportId,
      second.reportId,
    ]);
  });

  it('throws naming the input when the report array is empty', async () => {
    const reportFile = await writeReportFile('empty.json', []);
    const inputLabel = `thymian:${reportFile}`;

    await expect(
      loadThymianReports(reportFile, inputLabel, tmpDir),
    ).rejects.toThrow(
      new ThymianBaseError(
        `Unsupported Thymian report "${inputLabel}": the report array is empty — nothing to merge.`,
      ),
    );
  });

  it('throws naming the offending array-entry index when one entry fails reportSchema', async () => {
    const valid = sampleReport('valid-tool');
    const reportFile = await writeReportFile('mixed.json', [
      valid,
      { reportId: 'r-invalid' /* createdAt and runs missing */ },
    ]);
    const inputLabel = `thymian:${reportFile}`;

    await expect(
      loadThymianReports(reportFile, inputLabel, tmpDir),
    ).rejects.toThrow(`"${inputLabel}" (array entry 1)`);
  });

  it('throws with readTypedInputJson wording naming the input for a missing file', async () => {
    const missing = join(tmpDir, 'does-not-exist.json');
    const inputLabel = `thymian:${missing}`;

    await expect(
      loadThymianReports(missing, inputLabel, tmpDir),
    ).rejects.toThrow(`Failed to read Thymian report "${inputLabel}"`);
  });

  it('throws with readTypedInputJson wording naming the input for invalid JSON', async () => {
    const reportFile = await writeReportFile('broken.json', '{not json');
    const inputLabel = `thymian:${reportFile}`;

    await expect(
      loadThymianReports(reportFile, inputLabel, tmpDir),
    ).rejects.toThrow(`Failed to parse Thymian report "${inputLabel}"`);
  });
});
