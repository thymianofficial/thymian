import { describe, expect, it, vi } from 'vitest';

import {
  ajv,
  createAnalyzeExecution,
  createLintExecution,
  createReport,
  createTestCaseExecution,
  createToolRun,
  type LintWorkflowInput,
  reportSchema,
  Thymian,
  ThymianBaseError,
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
