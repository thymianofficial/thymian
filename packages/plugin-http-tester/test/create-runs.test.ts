import {
  httpRule,
  type HttpTestCase,
  type HttpTestCaseStep,
  type Logger,
  type RuleFnResult,
  type TestCaseExecution,
  ThymianFormat,
  type ThymianHttpTransaction,
} from '@thymian/core';
import { describe, expect, it, vi } from 'vitest';

import {
  createRuns,
  type HttpTesterRuleDiagnostics,
  type RuleFnResultPlacement,
} from '../src/index.js';

const PLUGIN = 'test-plugin';
const FORMAT = new ThymianFormat();

function makeLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  } as unknown as Logger;
}

const rule = httpRule('test/rule')
  .severity('warn')
  .type('test')
  .summary('Test rule')
  .rule(() => [])
  .done();

function makeResult(message?: string): RuleFnResult {
  return {
    location: { elementType: 'edge', elementId: 'tx-1' },
    violation: message !== undefined ? { message } : undefined,
    findings: [],
  };
}

function makeSingleStep(
  transactionId = 'tx-1',
  withHttpTransaction = false,
): HttpTestCaseStep {
  const source = { transactionId } as unknown as ThymianHttpTransaction;
  return {
    type: 'single',
    source,
    transactions: withHttpTransaction
      ? [
          {
            requestTemplate: {} as never,
            request: {
              origin: 'http://localhost',
              path: '/test',
              method: 'GET',
            } as never,
            response: { status: 200, headers: {} } as never,
          },
        ]
      : [],
  };
}

function makeGroupedStep(key = 'group-key'): HttpTestCaseStep {
  return {
    type: 'grouped',
    source: { key, transactions: [] },
    transactions: [],
  };
}

function makeCustomStep(source: unknown = { a: 1 }): HttpTestCaseStep {
  return {
    type: 'custom',
    source,
    transactions: [],
  };
}

function makeStep(withTransaction = false): HttpTestCaseStep {
  return makeSingleStep('tx-1', withTransaction);
}

function makePassedCase(name: string, steps: HttpTestCaseStep[]): HttpTestCase {
  return { name, status: 'passed', start: 0, end: 100, steps, results: [] };
}

function makeFailedCase(name: string, reason?: string): HttpTestCase {
  return {
    name,
    status: 'failed',
    ...(reason !== undefined ? { reason } : {}),
    start: 0,
    steps: [],
    results: [],
  };
}

function makeSkippedCase(name: string): HttpTestCase {
  return {
    name,
    status: 'skipped',
    reason: 'no matching traffic',
    start: 0,
    steps: [],
    results: [],
  };
}

function ruleResults(
  ruleFnResult: RuleFnResult[],
  diagnostics: HttpTesterRuleDiagnostics | undefined,
) {
  return { [rule.meta.name]: { ruleFnResult, diagnostics } };
}

/** Executions are flat TestCaseExecutions (no rule-grouping wrapper). */
function testCases(runExecutions: unknown): TestCaseExecution[] {
  return (runExecutions ?? []) as TestCaseExecution[];
}

describe('createRuns', () => {
  it('always emits a tool run, even with no executions or descriptors', () => {
    const runs = createRuns(PLUGIN, {}, [], FORMAT, makeLogger());
    expect(runs).toHaveLength(1);
    expect(runs[0]!.tool.name).toBe(PLUGIN);
    expect(runs[0]!.executions).toHaveLength(0);
    expect(runs[0]!.rules).toBeUndefined();
    // Must match the hash `finalizeWorkflow` uses to key `report.thymianFormat`,
    // or the reporter can never resolve `thymianFormat` locations.
    expect(runs[0]!.thymianFormatVersion).toBe(FORMAT.toHash());
  });

  it('emits one flat test-case execution per case (no rule wrapper)', () => {
    const cases = [
      makePassedCase('case-a', [makeStep()]),
      makePassedCase('case-b', []),
    ];
    const result = makeResult();
    const placements: RuleFnResultPlacement[] = [
      { result, testCaseIndex: 0, stepIndex: 0 },
    ];
    const diagnostics: HttpTesterRuleDiagnostics = [
      { testResult: { name: 'run', duration: 0, cases }, placements },
    ];

    const [run] = createRuns(
      PLUGIN,
      ruleResults([result], diagnostics),
      [rule],
      FORMAT,
      makeLogger(),
    );
    const cases2 = testCases(run!.executions);
    expect(cases2).toHaveLength(2);
    expect(cases2[0]!.kind).toBe('test');
    expect(cases2[0]!.ruleId).toBe('test/rule');
    expect(cases2[0]!.name).toBe('case-a');
    expect(cases2[1]!.name).toBe('case-b');
  });

  it('maps a passed case to a passed status with duration (AC6)', () => {
    const cases = [makePassedCase('my-test', [])];
    const diagnostics: HttpTesterRuleDiagnostics = [
      { testResult: { name: 'run', duration: 0, cases }, placements: [] },
    ];

    const [run] = createRuns(
      PLUGIN,
      ruleResults([], diagnostics),
      [rule],
      FORMAT,
      makeLogger(),
    );
    const testCase = testCases(run!.executions)[0]!;
    expect(testCase.status).toMatchObject({
      kind: 'passed',
      durationMilliseconds: 100,
    });
    expect('findings' in testCase).toBe(false);
  });

  it('maps a rule violation to a failed status (AC7)', () => {
    const violation = makeResult('assertion failed');
    const cases = [makePassedCase('failing-test', [makeStep()])];
    const placements: RuleFnResultPlacement[] = [
      { result: violation, testCaseIndex: 0, stepIndex: 0 },
    ];
    const diagnostics: HttpTesterRuleDiagnostics = [
      { testResult: { name: 'run', duration: 0, cases }, placements },
    ];

    const [run] = createRuns(
      PLUGIN,
      ruleResults([violation], diagnostics),
      [rule],
      FORMAT,
      makeLogger(),
    );
    expect(testCases(run!.executions)[0]!.status).toMatchObject({
      kind: 'failed',
      reason: 'assertion failed',
    });
  });

  it('maps a failed case WITHOUT a violation to skipped (could not execute)', () => {
    const cases = [makeFailedCase('failing-test', 'connection refused')];
    const diagnostics: HttpTesterRuleDiagnostics = [
      { testResult: { name: 'run', duration: 0, cases }, placements: [] },
    ];

    const [run] = createRuns(
      PLUGIN,
      ruleResults([], diagnostics),
      [rule],
      FORMAT,
      makeLogger(),
    );
    expect(testCases(run!.executions)[0]!.status).toMatchObject({
      kind: 'skipped',
      reason: 'connection refused',
    });
  });

  it('maps a rule-skip finding to a skipped status (and drops the finding)', () => {
    const skipResult: RuleFnResult = {
      location: { elementType: 'edge', elementId: 'tx-1' },
      findings: [{ kind: 'rule-skip', title: 'skip', reason: 'no endpoint' }],
    };
    const cases = [makePassedCase('my-test', [makeStep()])];
    const placements: RuleFnResultPlacement[] = [
      { result: skipResult, testCaseIndex: 0, stepIndex: 0 },
    ];
    const diagnostics: HttpTesterRuleDiagnostics = [
      { testResult: { name: 'run', duration: 0, cases }, placements },
    ];

    const [run] = createRuns(
      PLUGIN,
      ruleResults([skipResult], diagnostics),
      [rule],
      FORMAT,
      makeLogger(),
    );
    const testCase = testCases(run!.executions)[0]!;
    expect(testCase.status).toMatchObject({
      kind: 'skipped',
      reason: 'no endpoint',
    });
    expect(testCase.steps[0]!.findings).toHaveLength(0);
  });

  it('maps a skipped case to a skipped status (AC8)', () => {
    const cases = [makeSkippedCase('skipped-test')];
    const diagnostics: HttpTesterRuleDiagnostics = [
      { testResult: { name: 'run', duration: 0, cases }, placements: [] },
    ];

    const [run] = createRuns(
      PLUGIN,
      ruleResults([], diagnostics),
      [rule],
      FORMAT,
      makeLogger(),
    );
    expect(testCases(run!.executions)[0]!.status).toMatchObject({
      kind: 'skipped',
      reason: 'no matching traffic',
    });
  });

  it('produces a step for each step', () => {
    const cases = [makePassedCase('my-test', [makeStep(), makeStep()])];
    const diagnostics: HttpTesterRuleDiagnostics = [
      { testResult: { name: 'run', duration: 0, cases }, placements: [] },
    ];

    const [run] = createRuns(
      PLUGIN,
      ruleResults([], diagnostics),
      [rule],
      FORMAT,
      makeLogger(),
    );
    const testCase = testCases(run!.executions)[0]!;
    expect(testCase.steps).toHaveLength(2);
    expect(testCase.steps[0]!.name).toBe('Step 1');
    expect(testCase.steps[1]!.name).toBe('Step 2');
  });

  it('attaches httpTransactions to the step', () => {
    const cases = [makePassedCase('my-test', [makeStep(true)])];
    const diagnostics: HttpTesterRuleDiagnostics = [
      { testResult: { name: 'run', duration: 0, cases }, placements: [] },
    ];

    const [run] = createRuns(
      PLUGIN,
      ruleResults([], diagnostics),
      [rule],
      FORMAT,
      makeLogger(),
    );
    expect(
      testCases(run!.executions)[0]!.steps[0]!.httpTransactions,
    ).toHaveLength(1);
  });

  it('places a step-level violation (without ruleId) on the correct step (F11)', () => {
    const cases = [makePassedCase('my-test', [makeStep(), makeStep()])];
    const stepOneResult = makeResult('step-two-violation');
    const placements: RuleFnResultPlacement[] = [
      { result: stepOneResult, testCaseIndex: 0, stepIndex: 1 },
    ];
    const diagnostics: HttpTesterRuleDiagnostics = [
      { testResult: { name: 'run', duration: 0, cases }, placements },
    ];

    const [run] = createRuns(
      PLUGIN,
      ruleResults([stepOneResult], diagnostics),
      [rule],
      FORMAT,
      makeLogger(),
    );
    const testCase = testCases(run!.executions)[0]!;
    expect(testCase.steps[0]!.findings).toHaveLength(0);
    const violation = testCase.steps[1]!.findings[0]!;
    expect(violation.kind).toBe('rule-violation');
    expect('ruleId' in violation).toBe(false);
  });

  it('folds a case-level violation into the case status (no case findings)', () => {
    const cases = [makePassedCase('my-test', [makeStep()])];
    const testCaseResult = makeResult('test-case-violation');
    const placements: RuleFnResultPlacement[] = [
      { result: testCaseResult, testCaseIndex: 0, stepIndex: undefined },
    ];
    const diagnostics: HttpTesterRuleDiagnostics = [
      { testResult: { name: 'run', duration: 0, cases }, placements },
    ];

    const [run] = createRuns(
      PLUGIN,
      ruleResults([testCaseResult], diagnostics),
      [rule],
      FORMAT,
      makeLogger(),
    );
    const testCase = testCases(run!.executions)[0]!;
    // A violation drives the case to `failed` even though the HTTP case passed,
    // is consumed (no fallback), and produces no case-level findings.
    expect(run!.executions).toHaveLength(1);
    expect('findings' in testCase).toBe(false);
    expect(testCase.status).toMatchObject({
      kind: 'failed',
      reason: 'test-case-violation',
    });
    expect(testCase.steps[0]!.findings).toHaveLength(0);
  });

  it('does not double-render placed results via the fallback', () => {
    const cases = [makePassedCase('my-test', [makeStep()])];
    const placedResult = makeResult('placed');
    const placements: RuleFnResultPlacement[] = [
      { result: placedResult, testCaseIndex: 0, stepIndex: 0 },
    ];
    const diagnostics: HttpTesterRuleDiagnostics = [
      { testResult: { name: 'run', duration: 0, cases }, placements },
    ];

    const [run] = createRuns(
      PLUGIN,
      ruleResults([placedResult], diagnostics),
      [rule],
      FORMAT,
      makeLogger(),
    );
    const cases2 = testCases(run!.executions);
    expect(cases2).toHaveLength(1);
    expect(cases2[0]!.name).toBe('my-test');
  });

  it('emits a failed test case + warns for an unplaced violation result (AC9)', () => {
    const cases = [makePassedCase('my-test', [])];
    const placedResult = makeResult('placed');
    const unplacedResult: RuleFnResult = {
      location: 'GET /unplaced',
      violation: { message: 'unplaced boom' },
      findings: [],
    };
    const placements: RuleFnResultPlacement[] = [
      { result: placedResult, testCaseIndex: 0, stepIndex: undefined },
    ];
    const diagnostics: HttpTesterRuleDiagnostics = [
      { testResult: { name: 'run', duration: 0, cases }, placements },
    ];

    const logger = makeLogger();
    const [run] = createRuns(
      PLUGIN,
      ruleResults([placedResult, unplacedResult], diagnostics),
      [rule],
      FORMAT,
      logger,
    );
    const cases2 = testCases(run!.executions);
    expect(cases2).toHaveLength(2);
    expect(cases2[1]!.name).toBe('GET /unplaced');
    expect(cases2[1]!.status.kind).toBe('failed');
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('attaches a returned edge result to the step whose transaction it references', () => {
    // Simulates a rule that collects a violation in a `.transactions()` callback
    // and returns it without failing the case, so the context recorded no
    // placement — the result still references the executed transaction by edge id.
    const result: RuleFnResult = {
      location: { elementType: 'edge', elementId: 'tx-42' },
      violation: {},
      findings: [],
    };
    const step = {
      type: 'single',
      source: { transactionId: 'tx-42' },
      transactions: [
        {
          request: { origin: 'http://localhost', path: '/x', method: 'GET' },
          response: { statusCode: 200, headers: {} },
          source: { transactionId: 'tx-42' },
        },
      ],
    } as unknown as HttpTestCaseStep;
    const cases: HttpTestCase[] = [
      {
        name: 'GET /x',
        status: 'passed',
        start: 0,
        end: 5,
        steps: [step],
        results: [],
      } as unknown as HttpTestCase,
    ];
    const diagnostics: HttpTesterRuleDiagnostics = [
      { testResult: { name: 'run', duration: 0, cases }, placements: [] },
    ];

    const logger = makeLogger();
    const [run] = createRuns(
      PLUGIN,
      ruleResults([result], diagnostics),
      [rule],
      FORMAT,
      logger,
    );
    const cases2 = testCases(run!.executions);

    // Attached to the matching case (now failed) — no extra unplaced fallback case.
    expect(cases2).toHaveLength(1);
    expect(cases2[0]!.name).toBe('GET /x');
    expect(cases2[0]!.status.kind).toBe('failed');
    expect(
      cases2[0]!.steps[0]!.findings.some((f) => f.kind === 'rule-violation'),
    ).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  describe('step locations', () => {
    function stepLocationFor(step: HttpTestCaseStep) {
      const cases = [makePassedCase('my-test', [step])];
      const diagnostics: HttpTesterRuleDiagnostics = [
        { testResult: { name: 'run', duration: 0, cases }, placements: [] },
      ];
      const [run] = createRuns(
        PLUGIN,
        ruleResults([], diagnostics),
        [rule],
        FORMAT,
        makeLogger(),
      );
      return testCases(run!.executions)[0]!.steps[0]!.location;
    }

    it('uses thymianFormat edge location for a single step', () => {
      expect(stepLocationFor(makeSingleStep('tx-abc'))).toEqual({
        type: 'thymianFormat',
        elementType: 'edge',
        elementId: 'tx-abc',
        pointer: '',
      });
    });

    it('uses custom key location for a grouped step', () => {
      expect(stepLocationFor(makeGroupedStep('my-group'))).toEqual({
        type: 'custom',
        value: 'my-group',
      });
    });

    it('uses JSON-stringified location for a custom step with object source', () => {
      expect(
        stepLocationFor(makeCustomStep({ method: 'GET', path: '/test' })),
      ).toEqual({
        type: 'custom',
        value: JSON.stringify({ method: 'GET', path: '/test' }),
      });
    });

    it('uses stringified location for a custom step with primitive source', () => {
      expect(stepLocationFor(makeCustomStep('my-primitive-source'))).toEqual({
        type: 'custom',
        value: 'my-primitive-source',
      });
    });
  });
});
