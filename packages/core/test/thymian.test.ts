import type { JSONSchemaType } from 'ajv/dist/2020.js';
import { describe, expect, it, vi } from 'vitest';

import {
  ajv,
  createAnalyzeExecution,
  createLintExecution,
  createReport,
  createTestCaseExecution,
  createToolRun,
  type LintWorkflowInput,
  PluginRegistrationError,
  reportSchema,
  Thymian,
  ThymianBaseError,
  ThymianFormat,
  type ThymianPlugin,
} from '../src/index.js';

describe('Thymian workflows', () => {
  it('returns clean-run with an assembled report when no findings exist', async () => {
    const thymian = new Thymian();

    thymian.emitter.onAction('core.lint', async (_event, ctx) => {
      ctx.reply([
        createToolRun({
          tool: { name: 'clean-plugin' },
          runType: 'lint',
          executions: [
            createLintExecution({
              location: { type: 'custom', value: 'lint' },
              ruleId: 'example/rule',
              status: { kind: 'passed' },
            }),
          ],
        }),
      ]);
    });

    const report = await thymian.lint({ specification: [], rules: [] });

    expect(report.runs[0]?.tool.name).toBe('clean-plugin');

    await thymian.close();
  });

  it('returns findings when report contains warn or error findings', async () => {
    const thymian = new Thymian();

    thymian.emitter.onAction('core.test', async (_event, ctx) => {
      ctx.reply([
        createToolRun({
          tool: { name: 'warn-plugin' },
          runType: 'test',
          executions: [
            createTestCaseExecution({
              name: 'a failing case',
              ruleId: 'example/rule',
              status: { kind: 'failed', reason: 'Warning finding' },
              steps: [],
            }),
          ],
        }),
      ]);
    });

    const report = await thymian.test({ specification: [], rules: [] });

    expect(report.runs).toHaveLength(1);

    await thymian.close();
  });
});

describe('core.workflow.* actions', () => {
  it('routes core.workflow.lint to lint() and returns its Report (AC5)', async () => {
    const t = new Thymian();
    const fakeReport = createReport([]);
    const lintSpy = vi.spyOn(t, 'lint').mockResolvedValue(fakeReport);

    const input = {
      specification: [{ type: 'openapi', location: 'api.yaml' }],
    };
    const result = await t.emitter.emitAction('core.workflow.lint', input, {
      strategy: 'first',
    });

    expect(result).toBe(fakeReport);
    expect(lintSpy).toHaveBeenCalledTimes(1);
    expect(lintSpy).toHaveBeenCalledWith(input);

    await t.close();
  });

  it('routes core.workflow.test to test() and returns its Report (AC5)', async () => {
    const t = new Thymian();
    const fakeReport = createReport([]);
    const testSpy = vi.spyOn(t, 'test').mockResolvedValue(fakeReport);

    const input = {
      specification: [{ type: 'openapi', location: 'api.yaml' }],
      targetUrl: 'https://api.example.com',
    };
    const result = await t.emitter.emitAction('core.workflow.test', input, {
      strategy: 'first',
    });

    expect(result).toBe(fakeReport);
    expect(testSpy).toHaveBeenCalledTimes(1);
    expect(testSpy).toHaveBeenCalledWith(input);

    await t.close();
  });

  it('routes core.workflow.analyze to analyze() and returns its Report (AC5)', async () => {
    const t = new Thymian();
    const fakeReport = createReport([]);
    const analyzeSpy = vi.spyOn(t, 'analyze').mockResolvedValue(fakeReport);

    const input = {
      traffic: [{ type: 'har', location: 'traffic.har' }],
    };
    const result = await t.emitter.emitAction('core.workflow.analyze', input, {
      strategy: 'first',
    });

    expect(result).toBe(fakeReport);
    expect(analyzeSpy).toHaveBeenCalledTimes(1);
    expect(analyzeSpy).toHaveBeenCalledWith(input);

    await t.close();
  });

  it('rejects an invalid payload and does not invoke the workflow method (AC10)', async () => {
    const t = new Thymian();
    const lintSpy = vi.spyOn(t, 'lint');

    // Missing the required `specification` — the handler must throw
    // InvalidActionInputError before routing to lint().
    const invalid = {} as unknown as LintWorkflowInput;

    // Assert it rejects for the RIGHT reason: the handler's
    // InvalidActionInputError, not some unrelated throw. The message must also
    // carry the AJV failure detail (which field/why) — that detail is the only
    // thing the WS proxy forwards to the #300 client.
    await expect(
      t.emitter.emitAction('core.workflow.lint', invalid, {
        strategy: 'first',
      }),
    ).rejects.toMatchObject({
      name: 'InvalidActionInputError',
      message: expect.stringContaining('Invalid core.workflow.lint input'),
    });
    await expect(
      t.emitter.emitAction('core.workflow.lint', invalid, {
        strategy: 'first',
      }),
    ).rejects.toThrow(/specification/);

    expect(lintSpy).not.toHaveBeenCalled();

    await t.close();
  });

  it('surfaces a rejecting workflow method as an action error (AC6)', async () => {
    const t = new Thymian();
    vi.spyOn(t, 'lint').mockRejectedValue(new ThymianBaseError('boom'));

    const input = {
      specification: [{ type: 'openapi', location: 'api.yaml' }],
    };

    await expect(
      t.emitter.emitAction('core.workflow.lint', input, { strategy: 'first' }),
    ).rejects.toThrow('boom');

    await t.close();
  });

  it('produces a Report that validates against reportSchema via an unmocked round-trip (AC4)', async () => {
    const t = new Thymian();

    // Stub the detail action so the real lint() workflow can complete without
    // a linter plugin registered.
    t.emitter.onAction('core.lint', async (_event, ctx) => {
      ctx.reply([
        createToolRun({
          tool: { name: 'stub-linter' },
          runType: 'lint',
          executions: [
            createLintExecution({
              location: { type: 'custom', value: 'lint' },
              ruleId: 'example/rule',
              status: { kind: 'passed' },
            }),
          ],
        }),
      ]);
    });

    const report = await t.emitter.emitAction(
      'core.workflow.lint',
      { specification: [] },
      { strategy: 'first' },
    );

    expect(ajv.validate(reportSchema, report)).toBe(true);
    expect(ajv.errors).toBeNull();

    await t.close();
  });

  it('produces a Report from core.workflow.test that validates against reportSchema (AC4)', async () => {
    const t = new Thymian();

    // Stub the detail action so the real test() workflow can complete without
    // a tester plugin registered.
    t.emitter.onAction('core.test', async (_event, ctx) => {
      ctx.reply([
        createToolRun({
          tool: { name: 'stub-tester' },
          runType: 'test',
          executions: [
            createTestCaseExecution({
              name: 'a passing case',
              ruleId: 'example/rule',
              status: { kind: 'passed' },
              steps: [],
            }),
          ],
        }),
      ]);
    });

    const report = await t.emitter.emitAction(
      'core.workflow.test',
      { specification: [] },
      { strategy: 'first' },
    );

    expect(ajv.validate(reportSchema, report)).toBe(true);
    expect(ajv.errors).toBeNull();

    await t.close();
  });

  it('produces a Report from core.workflow.analyze that validates against reportSchema (AC4)', async () => {
    const t = new Thymian();

    // Stub the detail action so the real analyze() workflow can complete without
    // an analyzer plugin registered.
    t.emitter.onAction('core.analyze', async (_event, ctx) => {
      ctx.reply([
        createToolRun({
          tool: { name: 'stub-analyzer' },
          runType: 'analyze',
          executions: [
            createAnalyzeExecution({
              location: { type: 'custom', value: 'analyze' },
              ruleId: 'example/rule',
              status: { kind: 'passed' },
            }),
          ],
        }),
      ]);
    });

    const report = await t.emitter.emitAction(
      'core.workflow.analyze',
      { traffic: [] },
      { strategy: 'first' },
    );

    expect(ajv.validate(reportSchema, report)).toBe(true);
    expect(ajv.errors).toBeNull();

    await t.close();
  });
});

describe('Thymian.reportConvert()', () => {
  it('dispatches inputs and the serialized format to core.report.convert listeners', async () => {
    const t = new Thymian();
    let receivedPayload: unknown;

    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      receivedPayload = payload;
      ctx.reply([]);
    });

    await t.reportConvert({
      reports: [{ type: 'spectral', location: './report.json' }],
      specification: [{ type: 'openapi', location: 'api.yaml' }],
    });

    expect(receivedPayload).toMatchObject({
      inputs: [{ type: 'spectral', location: './report.json' }],
    });
    expect((receivedPayload as { format?: unknown }).format).toBeDefined();

    await t.close();
  });

  it('passes format: undefined when no specification is given', async () => {
    const t = new Thymian();
    let receivedPayload: unknown;

    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      receivedPayload = payload;
      ctx.reply([]);
    });

    await t.reportConvert({
      reports: [{ type: 'spectral', location: './report.json' }],
    });

    expect((receivedPayload as { format?: unknown }).format).toBeUndefined();

    await t.close();
  });

  it('assembles one run per input, in input order, into a Report validating against reportSchema', async () => {
    const t = new Thymian();

    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      ctx.reply(
        payload.inputs.map((input) => ({
          input: { type: input.type, location: String(input.location) },
          run: createToolRun({
            tool: { name: '@thymian/plugin-spectral' },
            runType: 'lint',
            executions: [
              createLintExecution({
                location: { type: 'custom', value: String(input.location) },
                ruleId: 'spectral/example',
                status: { kind: 'failed', reason: 'converted finding' },
              }),
            ],
          }),
        })),
      );
    });

    const outcome = await t.reportConvert({
      reports: [
        { type: 'spectral', location: './a.json' },
        { type: 'spectral', location: './b.json' },
      ],
    });

    expect(outcome.report.runs).toHaveLength(2);
    expect(
      outcome.report.runs.map((run) => run.executions?.[0]?.location),
    ).toEqual([
      { type: 'custom', value: './a.json' },
      { type: 'custom', value: './b.json' },
    ]);
    expect(outcome.unclaimed).toEqual([]);
    expect(ajv.validate(reportSchema, outcome.report)).toBe(true);
    expect(ajv.errors).toBeNull();

    await t.close();
  });

  it('includes runs from multiple listeners that claim the same input (ADR-0017)', async () => {
    const t = new Thymian();

    const makeFragmentReply =
      (toolName: string) =>
      async (
        payload: { inputs: { type: string; location: unknown }[] },
        ctx: { reply: (v: unknown) => void },
      ) => {
        ctx.reply(
          payload.inputs.map((input) => ({
            input: { type: input.type, location: String(input.location) },
            run: createToolRun({
              tool: { name: toolName },
              runType: 'lint',
              executions: [],
            }),
          })),
        );
      };

    t.emitter.onAction('core.report.convert', makeFragmentReply('plugin-a'));
    t.emitter.onAction('core.report.convert', makeFragmentReply('plugin-b'));

    const outcome = await t.reportConvert({
      reports: [{ type: 'spectral', location: './r.json' }],
    });

    expect(outcome.report.runs.map((run) => run.tool.name).sort()).toEqual([
      'plugin-a',
      'plugin-b',
    ]);
    expect(outcome.unclaimed).toEqual([]);

    await t.close();
  });

  it('derives unclaimed inputs from the reply union without throwing', async () => {
    const t = new Thymian();

    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      ctx.reply(
        payload.inputs
          .filter((input) => input.type === 'spectral')
          .map((input) => ({
            input: { type: input.type, location: String(input.location) },
            run: createToolRun({
              tool: { name: '@thymian/plugin-spectral' },
              runType: 'lint',
              executions: [],
            }),
          })),
      );
    });

    const outcome = await t.reportConvert({
      reports: [
        { type: 'spectral', location: './claimed.json' },
        { type: 'unknown-type', location: './unclaimed.json' },
      ],
    });

    expect(outcome.report.runs).toHaveLength(1);
    expect(outcome.unclaimed).toEqual([
      { type: 'unknown-type', location: './unclaimed.json' },
    ]);

    await t.close();
  });

  it('marks every input unclaimed and returns an empty-runs Report when no listener is registered', async () => {
    const t = new Thymian();

    const outcome = await t.reportConvert({
      reports: [{ type: 'spectral', location: './r.json' }],
    });

    expect(outcome.report.runs).toEqual([]);
    expect(outcome.unclaimed).toEqual([
      { type: 'spectral', location: './r.json' },
    ]);
    expect(ajv.validate(reportSchema, outcome.report)).toBe(true);

    await t.close();
  });

  it('does not stall or fail when a listener replies with an empty array', async () => {
    const t = new Thymian();

    t.emitter.onAction('core.report.convert', async (_payload, ctx) => {
      ctx.reply([]);
    });

    const outcome = await t.reportConvert({
      reports: [{ type: 'spectral', location: './r.json' }],
    });

    expect(outcome.report.runs).toEqual([]);
    expect(outcome.unclaimed).toEqual([
      { type: 'spectral', location: './r.json' },
    ]);

    await t.close();
  });

  it('collapses duplicate report inputs (same type and stringified location) before dispatch', async () => {
    const t = new Thymian();
    let receivedInputs: unknown;

    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      receivedInputs = payload.inputs;
      ctx.reply(
        payload.inputs.map((input) => ({
          input: { type: input.type, location: String(input.location) },
          run: createToolRun({
            tool: { name: '@thymian/plugin-spectral' },
            runType: 'lint',
            executions: [],
          }),
        })),
      );
    });

    const outcome = await t.reportConvert({
      reports: [
        { type: 'spectral', location: './r.json' },
        { type: 'spectral', location: './r.json' },
      ],
    });

    expect(receivedInputs).toEqual([
      { type: 'spectral', location: './r.json' },
    ]);
    expect(outcome.report.runs).toHaveLength(1);
    expect(outcome.unclaimed).toEqual([]);

    await t.close();
  });

  it('unions fragment thymianFormat maps by hash into the assembled report (#507)', async () => {
    const t = new Thymian();

    const formatA = { attributes: { hash: 'hash-a' }, nodes: [], edges: [] };
    const formatADuplicate = {
      attributes: { hash: 'hash-a' },
      nodes: [],
      edges: [],
    };
    const formatB = { attributes: { hash: 'hash-b' }, nodes: [], edges: [] };

    // Two independent listeners, each claiming its own input type and
    // carrying its own format map; hash-a arrives twice (identical graphs).
    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      ctx.reply(
        payload.inputs
          .filter((input) => input.type === 'thymian')
          .map((input) => ({
            input: { type: input.type, location: String(input.location) },
            run: createToolRun({
              tool: { name: 'thymian-report-reader' },
              runType: 'lint',
              executions: [],
              thymianFormatVersion: 'hash-a',
            }),
            thymianFormat: { 'hash-a': formatA },
          })),
      );
    });
    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      ctx.reply(
        payload.inputs
          .filter((input) => input.type === 'other')
          .map((input) => ({
            input: { type: input.type, location: String(input.location) },
            run: createToolRun({
              tool: { name: 'other-reader' },
              runType: 'lint',
              executions: [],
              thymianFormatVersion: 'hash-b',
            }),
            thymianFormat: { 'hash-a': formatADuplicate, 'hash-b': formatB },
          })),
      );
    });

    const outcome = await t.reportConvert({
      reports: [
        { type: 'thymian', location: './a.json' },
        { type: 'other', location: './b.json' },
      ],
    });

    expect(outcome.report.thymianFormat).toBeDefined();
    expect(Object.keys(outcome.report.thymianFormat ?? {}).sort()).toEqual([
      'hash-a',
      'hash-b',
    ]);
    // First occurrence wins on duplicate hashes (identical graphs anyway).
    expect(outcome.report.thymianFormat?.['hash-a']).toBe(formatA);
    expect(outcome.report.thymianFormat?.['hash-b']).toBe(formatB);
    // Runs keep pointing at their own hash.
    expect(outcome.report.runs.map((run) => run.thymianFormatVersion)).toEqual([
      'hash-a',
      'hash-b',
    ]);
    expect(ajv.validate(reportSchema, outcome.report)).toBe(true);

    await t.close();
  });

  it('treats prototype-member hash keys as plain data and skips junk map values (#507 review)', async () => {
    const t = new Thymian();

    // JSON.parse is the discriminating vehicle: unlike an object literal, it
    // creates '__proto__' as an *own* property — exactly what a persisted
    // `"thymianFormat": {"__proto__": {...}}` yields. On an unhardened plain
    // accumulator that key would hit the prototype setter, vanish from
    // Object.keys, and replace the accumulator's prototype.
    const hostileMap = JSON.parse(
      '{"__proto__": {"attributes": {"hash": "__proto__"}, "nodes": [], "edges": []}, "bad": null, "worse": []}',
    ) as NonNullable<import('../src/index.js').Report['thymianFormat']>;
    // Sanity-check the vehicle: the key must be an own property here.
    expect(Object.keys(hostileMap)).toContain('__proto__');

    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      ctx.reply(
        payload.inputs.map((input) => ({
          input: { type: input.type, location: String(input.location) },
          run: createToolRun({
            tool: { name: 'hostile-reader' },
            runType: 'lint',
            executions: [],
            thymianFormatVersion: '__proto__',
          }),
          thymianFormat: hostileMap,
        })),
      );
    });

    const outcome = await t.reportConvert({
      reports: [{ type: 'thymian', location: './hostile.json' }],
    });

    const formats = outcome.report.thymianFormat ?? {};
    // The entry survives as plain data (junk 'bad'/'worse' values skipped)…
    expect(Object.keys(formats)).toEqual(['__proto__']);
    expect(formats['__proto__']).toEqual({
      attributes: { hash: '__proto__' },
      nodes: [],
      edges: [],
    });
    // …and the public map keeps its ordinary prototype, unpolluted: the
    // hostile key must neither replace the prototype nor break consumers
    // that rely on Object.prototype members (#507 review — public shape).
    expect(Object.getPrototypeOf(formats)).toBe(Object.prototype);
    expect(formats instanceof Object).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(formats, '__proto__')).toBe(
      true,
    );

    await t.close();
  });

  it('keeps report.thymianFormat an ordinary plain-prototype object for single-workflow runs', async () => {
    const t = new Thymian();

    t.emitter.onAction('core.format.load', async (_payload, ctx) => {
      ctx.reply({ attributes: { hash: 'spec-hash' }, nodes: [], edges: [] });
    });
    t.emitter.onAction('core.lint', async (_payload, ctx) => {
      ctx.reply([
        createToolRun({
          tool: { name: 'lint-plugin' },
          runType: 'lint',
          executions: [],
          thymianFormatVersion: 'spec-hash',
        }),
      ]);
    });

    const report = await t.lint({
      specification: [{ type: 'openapi', location: 'api.yaml' }],
      rules: [],
    });

    // Public shape (#507 review): a consumer on `core.report` may use
    // Object.prototype members or strict equality against a literal.
    expect(Object.getPrototypeOf(report.thymianFormat)).toBe(Object.prototype);
    expect(report.thymianFormat instanceof Object).toBe(true);
    // loadFormat re-exports the merged graph, so the map key is the freshly
    // computed hash — one entry, self-describing.
    const hashes = Object.keys(report.thymianFormat ?? {});
    expect(hashes).toHaveLength(1);
    expect(report.thymianFormat?.[hashes[0]!]?.attributes.hash).toBe(hashes[0]);

    await t.close();
  });

  it('completes a missing thymianFormatVersion from the workflow format (single-workflow provenance)', async () => {
    const t = new Thymian();

    t.emitter.onAction('core.format.load', async (_payload, ctx) => {
      ctx.reply({ attributes: { hash: 'spec-hash' }, nodes: [], edges: [] });
    });
    t.emitter.onAction('core.lint', async (_payload, ctx) => {
      ctx.reply([
        // A producer that forgot to set thymianFormatVersion — previously
        // rescued by the render-side sole-entry fallback, now completed at
        // assembly, where the single-workflow provenance is certain.
        createToolRun({
          tool: { name: 'forgetful-plugin' },
          runType: 'lint',
          executions: [],
        }),
      ]);
    });

    const report = await t.lint({
      specification: [{ type: 'openapi', location: 'api.yaml' }],
      rules: [],
    });

    // The workflow format is re-exported by loadFormat with a computed hash;
    // the backfilled version must point at exactly that map entry.
    const formatHashes = Object.keys(report.thymianFormat ?? {});
    expect(formatHashes).toHaveLength(1);
    expect(report.runs[0]?.thymianFormatVersion).toBe(formatHashes[0]);
    expect(ajv.validate(reportSchema, report)).toBe(true);

    await t.close();
  });

  it('completes a missing thymianFormatVersion from a single-entry fragment map (per-input provenance)', async () => {
    const t = new Thymian();

    const format = { attributes: { hash: 'hash-a' }, nodes: [], edges: [] };

    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      ctx.reply(
        payload.inputs.map((input) => ({
          input: { type: input.type, location: String(input.location) },
          // The persisted run lost its version (older producer), but its
          // source report carries exactly one format — that one.
          run: createToolRun({
            tool: { name: 'thymian-report-reader' },
            runType: 'lint',
            executions: [],
          }),
          thymianFormat: { 'hash-a': format },
        })),
      );
    });

    const outcome = await t.reportConvert({
      reports: [{ type: 'thymian', location: './a.json' }],
    });

    expect(outcome.report.runs[0]?.thymianFormatVersion).toBe('hash-a');

    await t.close();
  });

  it('de-duplicates assembled runs on runId across inputs (same report under two paths)', async () => {
    const t = new Thymian();

    // One persisted run arriving under two different input paths — e.g.
    // `cp report.json copy.json` and both passed to `report merge`.
    const persistedRun = createToolRun({
      tool: { name: 'thymian-report-reader' },
      runType: 'lint',
      executions: [],
    });

    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      ctx.reply(
        payload.inputs.map((input) => ({
          input: { type: input.type, location: String(input.location) },
          run: persistedRun,
        })),
      );
    });

    const outcome = await t.reportConvert({
      reports: [
        { type: 'thymian', location: './report.json' },
        { type: 'thymian', location: './copy.json' },
      ],
    });

    expect(outcome.report.runs).toHaveLength(1);
    expect(outcome.report.runs[0]?.runId).toBe(persistedRun.runId);
    expect(outcome.unclaimed).toEqual([]);

    await t.close();
  });

  it('fails when two different runs share a runId instead of silently dropping one', async () => {
    const t = new Thymian();

    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      ctx.reply(
        payload.inputs.map((input, index) => ({
          input: { type: input.type, location: String(input.location) },
          // Same runId, differing content — a copied-then-edited report file.
          // Silently dropping the second run would erase its executions from
          // the merge (and possibly flip the exit code), so this must fail.
          run: {
            ...createToolRun({
              tool: { name: 'thymian-report-reader' },
              runType: 'lint',
              executions: [],
            }),
            runId: 'shared-id',
            runAt: `2026-01-0${index + 1}T00:00:00.000Z`,
          },
        })),
      );
    });

    await expect(
      t.reportConvert({
        reports: [
          { type: 'thymian', location: './report.json' },
          { type: 'thymian', location: './edited-copy.json' },
        ],
      }),
    ).rejects.toThrow(
      'Two different runs share runId "shared-id" (from thymian:./report.json and thymian:./edited-copy.json)',
    );

    await t.close();
  });

  it('withholds the core.report emission when inputs went unclaimed (no partial report reaches formatters)', async () => {
    const t = new Thymian();
    const reported = vi.fn();
    t.emitter.on('core.report', reported);

    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      ctx.reply(
        payload.inputs
          .filter((input) => input.type === 'thymian')
          .map((input) => ({
            input: { type: input.type, location: String(input.location) },
            run: createToolRun({
              tool: { name: 'thymian-report-reader' },
              runType: 'lint',
              executions: [],
            }),
          })),
      );
    });

    const unclaimedOutcome = await t.reportConvert({
      reports: [
        { type: 'thymian', location: './ok.json' },
        { type: 'bogus', location: './x.json' },
      ],
    });

    // The partial report is still returned for the caller's enforcement
    // path, but never emitted — a formatter must not persist it.
    expect(unclaimedOutcome.unclaimed).toHaveLength(1);
    expect(unclaimedOutcome.report.runs).toHaveLength(1);
    expect(reported).not.toHaveBeenCalled();

    const claimedOutcome = await t.reportConvert({
      reports: [{ type: 'thymian', location: './ok.json' }],
    });

    expect(claimedOutcome.unclaimed).toEqual([]);
    expect(reported).toHaveBeenCalledTimes(1);

    await t.close();
  });

  it('includes the workflow spec format only when a run actually converted against it', async () => {
    const t = new Thymian();

    t.emitter.onAction('core.format.load', async (_payload, ctx) => {
      ctx.reply({ attributes: { hash: 'spec-hash' }, nodes: [], edges: [] });
    });
    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      ctx.reply(
        payload.inputs.map((input) => ({
          input: { type: input.type, location: String(input.location) },
          // A pure passthrough run that never touched the --spec format.
          run: createToolRun({
            tool: { name: 'thymian-report-reader' },
            runType: 'lint',
            executions: [],
            thymianFormatVersion: 'hash-a',
          }),
          thymianFormat: {
            'hash-a': { attributes: { hash: 'hash-a' }, nodes: [], edges: [] },
          },
        })),
      );
    });

    const outcome = await t.reportConvert({
      reports: [{ type: 'thymian', location: './a.json' }],
      specification: [{ type: 'openapi', location: 'api.yaml' }],
    });

    // No run references spec-hash, so the merged map must not carry a
    // serialized graph no run points at.
    expect(Object.keys(outcome.report.thymianFormat ?? {})).toEqual(['hash-a']);

    await t.close();
  });

  it('keeps an untagged run versionless instead of completing it from --spec (claimant tagging contract)', async () => {
    const t = new Thymian();

    t.emitter.onAction('core.format.load', async (_payload, ctx) => {
      ctx.reply({ attributes: { hash: 'spec-hash' }, nodes: [], edges: [] });
    });
    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      ctx.reply(
        payload.inputs.map((input) => ({
          input: { type: input.type, location: String(input.location) },
          // A reply violating the tagging contract: no `thymianFormatVersion`
          // and no fragment map. Core cannot tell this apart from a
          // conversion that never used the format, so it must not guess.
          run: createToolRun({
            tool: { name: '@thymian/plugin-spectral' },
            runType: 'lint',
            executions: [],
          }),
        })),
      );
    });

    const outcome = await t.reportConvert({
      reports: [{ type: 'spectral', location: './r.json' }],
      specification: [{ type: 'openapi', location: 'api.yaml' }],
    });

    // The run stays versionless (format references degrade to raw
    // `format:<elementId>` text at render time) and the unused graph is
    // withheld — completing from --spec would attribute a format the run may
    // never have converted against.
    expect(outcome.report.runs[0].thymianFormatVersion).toBeUndefined();
    expect(outcome.report.thymianFormat).toBeUndefined();

    await t.close();
  });

  it('does not complete a versionless passthrough run from --spec in a mixed merge', async () => {
    const t = new Thymian();

    // export() recomputes the hash from nodes/edges (the mocked attribute is
    // discarded), so derive the hash the assembled report will actually see.
    const specHash = ThymianFormat.import({
      attributes: { hash: 'ignored' },
      nodes: [],
      edges: [],
    }).export().attributes.hash;

    t.emitter.onAction('core.format.load', async (_payload, ctx) => {
      ctx.reply({ attributes: { hash: 'ignored' }, nodes: [], edges: [] });
    });
    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      ctx.reply(
        payload.inputs.map((input) =>
          input.type === 'spectral'
            ? {
                input: { type: input.type, location: String(input.location) },
                // Converted against the workflow --spec and tagged with it.
                run: createToolRun({
                  tool: { name: '@thymian/plugin-spectral' },
                  runType: 'lint',
                  executions: [],
                  thymianFormatVersion: specHash,
                }),
              }
            : {
                input: { type: input.type, location: String(input.location) },
                // A versionless passthrough (persisted without a spec, so no
                // fragment map either) — it must NOT inherit spec-hash: the
                // tagged run makes the workflow format join the report while
                // fragmentFormats stays empty, the exact shape where an
                // additionalFormats-based backfill heuristic would leak.
                run: createToolRun({
                  tool: { name: 'thymian-report-reader' },
                  runType: 'lint',
                  executions: [],
                }),
              },
        ),
      );
    });

    const outcome = await t.reportConvert({
      reports: [
        { type: 'spectral', location: './s.json' },
        { type: 'thymian', location: './old.json' },
      ],
      specification: [{ type: 'openapi', location: 'api.yaml' }],
    });

    const versions = outcome.report.runs.map((run) => run.thymianFormatVersion);
    expect(versions).toEqual([specHash, undefined]);
    expect(Object.keys(outcome.report.thymianFormat ?? {})).toEqual([specHash]);

    await t.close();
  });

  it('leaves report.thymianFormat undefined when no fragment carries a map and no spec is given', async () => {
    const t = new Thymian();

    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      ctx.reply(
        payload.inputs.map((input) => ({
          input: { type: input.type, location: String(input.location) },
          run: createToolRun({
            tool: { name: '@thymian/plugin-spectral' },
            runType: 'lint',
            executions: [],
          }),
        })),
      );
    });

    const outcome = await t.reportConvert({
      reports: [{ type: 'spectral', location: './r.json' }],
    });

    expect(outcome.report.thymianFormat).toBeUndefined();

    await t.close();
  });

  it('propagates a listener error as a workflow failure instead of an unclaimed input', async () => {
    const t = new Thymian();

    t.emitter.onAction('core.report.convert', async () => {
      throw new Error('conversion exploded');
    });

    await expect(
      t.reportConvert({
        reports: [{ type: 'spectral', location: './r.json' }],
      }),
    ).rejects.toThrow('conversion exploded');

    await t.close();
  });

  it('executes as a full workflow through Thymian.run() (AC1)', async () => {
    const t = new Thymian();

    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      ctx.reply(
        payload.inputs.map((input) => ({
          input: { type: input.type, location: String(input.location) },
          run: createToolRun({
            tool: { name: '@thymian/plugin-spectral' },
            runType: 'lint',
            executions: [],
          }),
        })),
      );
    });

    const outcome = await t.run(() =>
      t.reportConvert({
        reports: [{ type: 'spectral', location: './r.json' }],
      }),
    );

    expect(outcome.report.runs).toHaveLength(1);
    expect(outcome.unclaimed).toEqual([]);
  });

  it('emits the core.report event with the assembled report (accepted core.report overload)', async () => {
    const t = new Thymian();
    const emitted: unknown[] = [];
    t.emitter.on('core.report', (report) => {
      emitted.push(report);
    });

    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      ctx.reply(
        payload.inputs.map((input) => ({
          input: { type: input.type, location: String(input.location) },
          run: createToolRun({
            tool: { name: '@thymian/plugin-spectral' },
            runType: 'lint',
            executions: [],
          }),
        })),
      );
    });

    const outcome = await t.reportConvert({
      reports: [{ type: 'spectral', location: './r.json' }],
    });

    expect(emitted).toEqual([outcome.report]);

    await t.close();
  });
});

describe('Thymian.register plugin-options validation', () => {
  type PluginOptions = {
    endpoint: string;
    retries: number;
  };

  const optionsSchema: JSONSchemaType<PluginOptions> = {
    type: 'object',
    properties: {
      endpoint: { type: 'string' },
      retries: { type: 'number', minimum: 0 },
    },
    required: ['endpoint', 'retries'],
    additionalProperties: false,
  };

  const buildPlugin = (): ThymianPlugin<PluginOptions> => ({
    name: '@example/plugin',
    version: '*',
    plugin: async () => undefined,
    options: optionsSchema,
  });

  it('throws PluginRegistrationError with human-readable detail for invalid options', () => {
    const thymian = new Thymian();

    let thrown: unknown;
    try {
      thymian.register(buildPlugin(), {
        retries: -1,
      } as unknown as PluginOptions);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(PluginRegistrationError);
    const error = thrown as PluginRegistrationError;

    expect(error.message).toMatch(/^Invalid options for plugin "/);
    expect(error.message).toContain('@example/plugin');
    // Carries the human-readable Ajv detail after the stable stem.
    expect(error.message).toContain('endpoint');
  });

  it('registers without throwing for valid options', () => {
    const thymian = new Thymian();

    expect(() =>
      thymian.register(buildPlugin(), {
        endpoint: 'https://example.com',
        retries: 3,
      }),
    ).not.toThrow();
  });
});

describe('Thymian.reportDiff()', () => {
  const makeRun = (runId: string, reason?: string) => ({
    ...createToolRun({
      tool: { name: '@thymian/plugin-reporter' },
      runType: 'lint',
      executions: [
        createLintExecution({
          location: { type: 'file', path: 'api.yaml' },
          status: { kind: 'failed', ...(reason ? { reason } : {}) },
          ruleId: 'rfc9110/x',
        }),
      ],
      rules: [{ id: 'rfc9110/x', severity: 'error' }],
    }),
    runId,
  });

  /** Claim every input with one fragment per configured entry. */
  const claimWith = (
    t: Thymian,
    fragmentsByLocation: Record<
      string,
      {
        run: ReturnType<typeof createToolRun>;
        report?: { reportId: string; createdAt: string };
      }[]
    >,
  ) => {
    const payloads: unknown[] = [];

    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      payloads.push(payload);
      ctx.reply(
        payload.inputs.flatMap((input) =>
          (fragmentsByLocation[String(input.location)] ?? []).map((entry) => ({
            input: { type: input.type, location: String(input.location) },
            ...entry,
          })),
        ),
      );
    });

    return payloads;
  };

  it('loads each side with its own action emission and yields an empty diff for a self-copy', async () => {
    const t = new Thymian();
    const identity = { reportId: 'r1', createdAt: '2026-08-26T00:00:00.000Z' };
    const run = makeRun('run-1');
    const payloads = claimWith(t, {
      './base.json': [{ run, report: identity }],
      './head.json': [{ run, report: identity }],
    });

    const outcome = await t.reportDiff({
      base: { type: 'thymian', location: './base.json' },
      head: { type: 'thymian', location: './head.json' },
    });

    expect(payloads).toHaveLength(2);
    expect(outcome.unclaimed).toEqual([]);
    expect(outcome.diff).toMatchObject({
      baseReportId: 'r1',
      headReportId: 'r1',
      changes: [],
    });

    await t.close();
  });

  it('never trips the cross-input runId dedup: a copied-then-edited pair diffs instead of throwing', async () => {
    const t = new Thymian();
    const run = makeRun('shared-run-id');
    const edited = {
      ...makeRun('shared-run-id', 'now with a reason'),
      runId: run.runId,
    };
    claimWith(t, {
      './base.json': [
        {
          run,
          report: { reportId: 'a', createdAt: '2026-01-01T00:00:00.000Z' },
        },
      ],
      './head.json': [
        {
          run: { ...edited, runId: run.runId },
          report: { reportId: 'b', createdAt: '2026-02-01T00:00:00.000Z' },
        },
      ],
    });

    const outcome = await t.reportDiff({
      base: { type: 'thymian', location: './base.json' },
      head: { type: 'thymian', location: './head.json' },
    });

    expect(outcome.diff?.changes).toHaveLength(2);

    await t.close();
  });

  it('returns both inputs as unclaimed without computing a diff', async () => {
    const t = new Thymian();
    claimWith(t, {});

    const outcome = await t.reportDiff({
      base: { type: 'thymian', location: './base.json' },
      head: { type: 'thymian', location: './head.json' },
    });

    expect(outcome.diff).toBeUndefined();
    expect(outcome.unclaimed).toEqual([
      { type: 'thymian', location: './base.json' },
      { type: 'thymian', location: './head.json' },
    ]);

    await t.close();
  });

  it('rejects a side that contains more than one report', async () => {
    const t = new Thymian();
    claimWith(t, {
      './base.json': [
        {
          run: makeRun('run-1'),
          report: { reportId: 'r1', createdAt: 'x' },
        },
        {
          run: makeRun('run-2'),
          report: { reportId: 'r2', createdAt: 'y' },
        },
      ],
    });

    await expect(
      t.reportDiff({
        base: { type: 'thymian', location: './base.json' },
        head: { type: 'thymian', location: './head.json' },
      }),
    ).rejects.toThrow(/contains 2 reports/);

    await t.close();
  });

  it('rejects a side whose fragments carry no source-report identity', async () => {
    const t = new Thymian();
    claimWith(t, {
      './base.json': [{ run: makeRun('run-1') }],
    });

    await expect(
      t.reportDiff({
        base: { type: 'thymian', location: './base.json' },
        head: { type: 'thymian', location: './head.json' },
      }),
    ).rejects.toThrow(/did not carry its source report's identity/);

    await t.close();
  });

  it('never emits core.report — the diff must not reach the file formatters', async () => {
    const t = new Thymian();
    const reportEvents: unknown[] = [];
    t.emitter.on('core.report', async (report) => {
      reportEvents.push(report);
    });
    const identity = { reportId: 'r1', createdAt: '2026-08-26T00:00:00.000Z' };
    const run = makeRun('run-1');
    claimWith(t, {
      './base.json': [{ run, report: identity }],
      './head.json': [{ run, report: identity }],
    });

    const outcome = await t.reportDiff({
      base: { type: 'thymian', location: './base.json' },
      head: { type: 'thymian', location: './head.json' },
    });

    expect(outcome.diff).toBeDefined();
    expect(reportEvents).toEqual([]);

    await t.close();
  });
});
