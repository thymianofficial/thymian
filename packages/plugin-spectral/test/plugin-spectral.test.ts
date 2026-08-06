import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Thymian, ThymianFormat } from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createSpectralPlugin } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const multiFindingFixture = join(__dirname, 'fixtures', 'multi-finding.json');

describe('plugin-spectral', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'plugin-spectral-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('claims only spectral inputs; other types stay unclaimed', async () => {
    const thymian = new Thymian().register(createSpectralPlugin());
    await thymian.ready();

    const outcome = await thymian.reportConvert({
      reports: [
        { type: 'spectral', location: multiFindingFixture },
        { type: 'not-spectral', location: './other.json' },
      ],
    });

    expect(outcome.report.runs).toHaveLength(1);
    expect(outcome.unclaimed).toEqual([
      { type: 'not-spectral', location: './other.json' },
    ]);

    await thymian.close();
  });

  it('replies an empty fragment list without stalling when nothing is claimed', async () => {
    const thymian = new Thymian().register(createSpectralPlugin());
    await thymian.ready();

    const outcome = await thymian.reportConvert({
      reports: [{ type: 'not-spectral', location: './other.json' }],
    });

    expect(outcome.report.runs).toEqual([]);
    expect(outcome.unclaimed).toHaveLength(1);

    await thymian.close();
  });

  it('replies one tagged run per claimed input, in input order', async () => {
    const emptyFile = join(tmpDir, 'empty.json');
    await writeFile(emptyFile, '[]');

    const thymian = new Thymian().register(createSpectralPlugin());
    await thymian.ready();

    const outcome = await thymian.reportConvert({
      reports: [
        { type: 'spectral', location: multiFindingFixture },
        { type: 'spectral', location: emptyFile },
      ],
    });

    expect(outcome.unclaimed).toEqual([]);
    expect(outcome.report.runs).toHaveLength(2);
    expect(outcome.report.runs[0]?.executions?.length).toBeGreaterThan(0);
    expect(outcome.report.runs[1]?.executions).toEqual([]);

    await thymian.close();
  });

  it('converts the committed real Spectral fixture into a lint run with full traceability', async () => {
    const thymian = new Thymian().register(createSpectralPlugin());
    await thymian.ready();

    const outcome = await thymian.reportConvert({
      reports: [{ type: 'spectral', location: multiFindingFixture }],
    });

    const run = outcome.report.runs[0];
    expect(run).toMatchObject({
      runType: 'lint',
      tool: { name: '@thymian/plugin-spectral' },
    });
    expect(run?.executions).toHaveLength(7);
    expect(
      run?.executions?.every(
        (execution) =>
          execution.status.kind === 'failed' &&
          execution.status.severity === 'warn' &&
          execution.ruleId?.startsWith('spectral/'),
      ),
    ).toBe(true);
    expect(run?.rules?.map((rule) => rule.id)).toContain(
      'spectral/oas3-api-servers',
    );

    await thymian.close();
  });

  it('converts an empty Spectral report to a clean run with zero executions', async () => {
    const emptyFile = join(tmpDir, 'empty.json');
    await writeFile(emptyFile, '[]');

    const thymian = new Thymian().register(createSpectralPlugin());
    await thymian.ready();

    const outcome = await thymian.reportConvert({
      reports: [{ type: 'spectral', location: emptyFile }],
    });

    expect(outcome.unclaimed).toEqual([]);
    expect(outcome.report.runs[0]?.executions).toEqual([]);

    await thymian.close();
  });

  it('rejects malformed JSON naming the offending input', async () => {
    const badFile = join(tmpDir, 'bad.json');
    await writeFile(badFile, 'not-json{{{');

    const thymian = new Thymian().register(createSpectralPlugin());
    await thymian.ready();

    await expect(() =>
      thymian.reportConvert({
        reports: [{ type: 'spectral', location: badFile }],
      }),
    ).rejects.toThrowError(new RegExp(`spectral:${badFile}`));

    await thymian.close();
  });

  it('rejects a payload that is not a result array, naming the offending input', async () => {
    const wrongShape = join(tmpDir, 'object.json');
    await writeFile(wrongShape, JSON.stringify({ results: [] }));

    const thymian = new Thymian().register(createSpectralPlugin());
    await thymian.ready();

    await expect(() =>
      thymian.reportConvert({
        reports: [{ type: 'spectral', location: wrongShape }],
      }),
    ).rejects.toThrowError(/spectral:.*object\.json/);

    await thymian.close();
  });

  it('rejects result entries missing required fields, naming the offending input', async () => {
    const missingFields = join(tmpDir, 'missing.json');
    await writeFile(
      missingFields,
      JSON.stringify([{ code: 'rule-without-message', severity: 1 }]),
    );

    const thymian = new Thymian().register(createSpectralPlugin());
    await thymian.ready();

    await expect(() =>
      thymian.reportConvert({
        reports: [{ type: 'spectral', location: missingFields }],
      }),
    ).rejects.toThrowError(/spectral:.*missing\.json/);

    await thymian.close();
  });

  it('tolerates unknown extra fields and converts unknown severities conservatively', async () => {
    const oddFile = join(tmpDir, 'odd.json');
    await writeFile(
      oddFile,
      JSON.stringify([
        {
          code: 'future-rule',
          message: 'from the future',
          severity: 9,
          path: [],
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 },
          },
          futureField: { anything: true },
        },
      ]),
    );

    const thymian = new Thymian().register(createSpectralPlugin());
    await thymian.ready();

    const outcome = await thymian.reportConvert({
      reports: [{ type: 'spectral', location: oddFile }],
    });

    expect(outcome.report.runs[0]?.executions?.[0]?.status).toMatchObject({
      kind: 'failed',
      severity: 'error',
    });

    await thymian.close();
  });

  it('resolves relative locations against the plugin cwd option', async () => {
    await writeFile(join(tmpDir, 'relative.json'), '[]');

    // cwd is injected into every plugin's options from the Thymian instance.
    const thymian = new Thymian(undefined, { cwd: tmpDir }).register(
      createSpectralPlugin(),
    );
    await thymian.ready();

    const outcome = await thymian.reportConvert({
      reports: [{ type: 'spectral', location: 'relative.json' }],
    });

    expect(outcome.unclaimed).toEqual([]);
    expect(outcome.report.runs).toHaveLength(1);

    await thymian.close();
  });

  it('carries the payload format hash and maps findings onto format nodes', async () => {
    const format = new ThymianFormat();
    const [nodeId] = format.addHttpTransaction(
      createHttpRequest({
        path: '/users',
        sourceName: 'api.yaml',
        sourceLocation: {
          path: 'api.yaml',
          position: { line: 1, column: 1, offset: 0 },
        },
      }),
      createHttpResponse(),
      'api.yaml',
    );
    const serialized = format.export();

    const thymian = new Thymian().register(createSpectralPlugin());
    await thymian.ready();

    const replies = await thymian.emitter.emitAction(
      'core.report.convert',
      {
        inputs: [{ type: 'spectral', location: multiFindingFixture }],
        format: serialized,
      },
      { strategy: 'collect' },
    );

    const run = replies.flat()[0]?.run;
    expect(run?.thymianFormatVersion).toBe(serialized.attributes.hash);
    expect(
      run?.executions?.some(
        (execution) =>
          execution.kind === 'lint' &&
          execution.location.type === 'thymianFormat' &&
          execution.location.elementId === nodeId,
      ),
    ).toBe(true);

    await thymian.close();
  });
});
