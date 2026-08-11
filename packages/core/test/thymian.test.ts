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

    const format = {
      attributes: { hash: 'constructor' },
      nodes: [],
      edges: [],
    };

    t.emitter.onAction('core.report.convert', async (payload, ctx) => {
      ctx.reply(
        payload.inputs.map((input) => ({
          input: { type: input.type, location: String(input.location) },
          run: createToolRun({
            tool: { name: 'hostile-reader' },
            runType: 'lint',
            executions: [],
            thymianFormatVersion: 'constructor',
          }),
          // 'constructor' collides with an Object.prototype member; 'bad'
          // carries a junk value a hand-edited persisted map could contain.
          thymianFormat: {
            constructor: format,
            bad: null,
          } as unknown as NonNullable<
            import('../src/index.js').Report['thymianFormat']
          >,
        })),
      );
    });

    const outcome = await t.reportConvert({
      reports: [{ type: 'thymian', location: './hostile.json' }],
    });

    expect(outcome.report.thymianFormat?.['constructor']).toBe(format);
    expect(Object.keys(outcome.report.thymianFormat ?? {})).toEqual([
      'constructor',
    ]);

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
