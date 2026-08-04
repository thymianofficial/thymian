import {
  httpRule,
  type HttpTestCase,
  type HttpTestCaseResult,
  type HttpTestCaseStep,
  type Logger,
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

/** A single step with one complete (request+response) transaction. */
function stepWithTransaction(transactionId: string): HttpTestCaseStep {
  return {
    type: 'single',
    source: { transactionId } as unknown as ThymianHttpTransaction,
    transactions: [
      {
        request: { origin: 'http://localhost', path: '/x', method: 'GET' },
        response: { statusCode: 500, headers: {} },
      },
    ],
  } as unknown as HttpTestCaseStep;
}

function runFor(
  cases: HttpTestCase[],
  placements: RuleFnResultPlacement[],
): TestCaseExecution[] {
  const diagnostics: HttpTesterRuleDiagnostics = [
    { testResult: { name: 'run', duration: 0, cases }, placements },
  ];
  const [run] = createRuns(
    PLUGIN,
    { [rule.meta.name]: { ruleFnResult: [], diagnostics } },
    [rule],
    FORMAT,
    makeLogger(),
  );
  return (run?.executions ?? []) as TestCaseExecution[];
}

describe('HttpTestCaseResult → report finding mapping', () => {
  it('maps every result kind onto the owning step, losslessly', () => {
    const results: HttpTestCaseResult[] = [
      {
        type: 'assertion-success',
        message: 'status is 200',
        assertion: 'status',
        location: { stepIdx: 0, transactionIdx: 0 },
      },
      {
        type: 'assertion-failure',
        message: 'status mismatch',
        assertion: 'status',
        expected: 200,
        actual: 500,
        location: { stepIdx: 0, transactionIdx: 0 },
      },
      {
        type: 'info',
        message: 'noted',
        details: 'some detail',
        location: { stepIdx: 1, transactionIdx: 0 },
      },
      {
        type: 'warning',
        message: 'careful',
        details: 'heads up',
        location: { stepIdx: 1, transactionIdx: 0 },
      },
    ];

    const cases: HttpTestCase[] = [
      {
        name: 'case',
        status: 'failed',
        start: 0,
        end: 10,
        steps: [stepWithTransaction('tx-0'), stepWithTransaction('tx-1')],
        results,
      } as unknown as HttpTestCase,
    ];

    const [execution] = runFor(cases, []);
    const step0 = execution!.steps[0]!;
    const step1 = execution!.steps[1]!;

    // Step 0: success + failure, each on the correct step.
    expect(step0.findings.map((f) => f.kind).sort()).toEqual([
      'assertion-failure',
      'assertion-success',
    ]);

    const failure = step0.findings.find((f) => f.kind === 'assertion-failure')!;
    expect(failure).toMatchObject({
      kind: 'assertion-failure',
      // The title is the human-readable message, not the assert operator/name.
      title: 'status mismatch',
      expected: 200,
      actual: 500,
      transactionIndex: 0,
    });
    // The transactionIndex resolves to a captured exchange on the step.
    expect(step0.httpTransactions?.[failure.transactionIndex!]).toBeDefined();

    // Step 1: info + warning both map to informational detail.
    expect(step1.findings.map((f) => f.kind)).toEqual([
      'informational',
      'informational',
    ]);
    expect(step1.findings.map((f) => f.message?.text)).toEqual([
      'some detail',
      'heads up',
    ]);
  });

  it('carries invalid-transaction detail with its transaction index', () => {
    const cases: HttpTestCase[] = [
      {
        name: 'case',
        status: 'failed',
        start: 0,
        steps: [stepWithTransaction('tx-0')],
        results: [
          {
            type: 'invalid-transaction',
            message: 'invalid transaction',
            details: 'bad shape',
            location: { stepIdx: 0, transactionIdx: 0 },
          },
        ] satisfies HttpTestCaseResult[],
      } as unknown as HttpTestCase,
    ];

    const [execution] = runFor(cases, []);
    const finding = execution!.steps[0]!.findings[0]!;

    expect(finding).toMatchObject({
      kind: 'informational',
      transactionIndex: 0,
    });
  });

  it('does not duplicate a violation marker when detail findings exist', () => {
    const violationPlacement: RuleFnResultPlacement = {
      result: {
        location: { elementType: 'edge', elementId: 'tx-0' },
        violation: {},
        findings: [],
      },
      testCaseIndex: 0,
      stepIndex: 0,
    };

    const cases: HttpTestCase[] = [
      {
        name: 'case',
        status: 'failed',
        start: 0,
        steps: [stepWithTransaction('tx-0')],
        results: [
          {
            type: 'assertion-failure',
            message: 'bad',
            assertion: 'status',
            expected: 1,
            actual: 2,
            location: { stepIdx: 0, transactionIdx: 0 },
          },
        ] satisfies HttpTestCaseResult[],
      } as unknown as HttpTestCase,
    ];

    const [execution] = runFor(cases, [violationPlacement]);

    // Only the detailed assertion-failure — no extra generic rule-violation marker.
    expect(execution!.steps[0]!.findings.map((f) => f.kind)).toEqual([
      'assertion-failure',
    ]);
    expect(execution!.status.kind).toBe('failed');
  });
});
