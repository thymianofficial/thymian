import {
  httpRule,
  type HttpTestCase,
  type HttpTestCaseStep,
  type RuleFnResult,
  ThymianFormat,
  type ThymianHttpTransaction,
} from '@thymian/core';
import { describe, expect, it } from 'vitest';

import {
  createRuns,
  type HttpTesterRuleDiagnostics,
  type RuleFnResultPlacement,
} from '../src/index.js';

const PLUGIN = 'test-plugin';
const FORMAT = new ThymianFormat();

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

function makeFailedCase(name: string): HttpTestCase {
  return {
    name,
    status: 'failed',
    reason: 'assertion failed',
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

describe('createRuns', () => {
  it('returns empty array when no rules ran', () => {
    const runs = createRuns(PLUGIN, {}, [], FORMAT);
    expect(runs).toHaveLength(0);
  });

  it('returns empty array when rule has no executions and no descriptors', () => {
    // rule not in ruleMap → skipped, ruleExecutions stays empty
    const runs = createRuns(PLUGIN, {}, [], FORMAT);
    expect(runs).toHaveLength(0);
  });

  it('builds a rule execution child for each test case', () => {
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
    );
    const ruleExecution = run!.executions![0];
    expect(ruleExecution!.children).toHaveLength(2);
    expect(ruleExecution!.children![0]!.name).toBe('case-a');
    expect(ruleExecution!.children![1]!.name).toBe('case-b');
  });

  it('emits test-case-pass finding for passed case', () => {
    const cases = [makePassedCase('my-test', [])];
    const diagnostics: HttpTesterRuleDiagnostics = [
      { testResult: { name: 'run', duration: 0, cases }, placements: [] },
    ];

    const [run] = createRuns(
      PLUGIN,
      ruleResults([], diagnostics),
      [rule],
      FORMAT,
    );
    const testCaseExecution = run!.executions![0]!.children![0]!;
    expect(testCaseExecution.findings[0]!.kind).toBe('test-case-pass');
    expect(testCaseExecution.findings[0]!.title).toBe('my-test');
  });

  it('emits test-case-fail finding for failed case', () => {
    const cases = [makeFailedCase('failing-test')];
    const diagnostics: HttpTesterRuleDiagnostics = [
      { testResult: { name: 'run', duration: 0, cases }, placements: [] },
    ];

    const [run] = createRuns(
      PLUGIN,
      ruleResults([], diagnostics),
      [rule],
      FORMAT,
    );
    const finding = run!.executions![0]!.children![0]!.findings[0]!;
    expect(finding.kind).toBe('test-case-fail');
    expect(finding.severity).toBe('error');
  });

  it('emits test-case-skip finding for skipped case', () => {
    const cases = [makeSkippedCase('skipped-test')];
    const diagnostics: HttpTesterRuleDiagnostics = [
      { testResult: { name: 'run', duration: 0, cases }, placements: [] },
    ];

    const [run] = createRuns(
      PLUGIN,
      ruleResults([], diagnostics),
      [rule],
      FORMAT,
    );
    const finding = run!.executions![0]!.children![0]!.findings[0]!;
    expect(finding.kind).toBe('test-case-skip');
    expect(finding.severity).toBe('info');
  });

  it('produces a step execution for each step', () => {
    const cases = [makePassedCase('my-test', [makeStep(), makeStep()])];
    const diagnostics: HttpTesterRuleDiagnostics = [
      { testResult: { name: 'run', duration: 0, cases }, placements: [] },
    ];

    const [run] = createRuns(
      PLUGIN,
      ruleResults([], diagnostics),
      [rule],
      FORMAT,
    );
    const testCaseExecution = run!.executions![0]!.children![0]!;
    expect(testCaseExecution.children).toHaveLength(2);
    expect(testCaseExecution.children![0]!.name).toBe('Step 1');
    expect(testCaseExecution.children![1]!.name).toBe('Step 2');
  });

  it('attaches httpTransactions to the step execution', () => {
    const cases = [makePassedCase('my-test', [makeStep(true)])];
    const diagnostics: HttpTesterRuleDiagnostics = [
      { testResult: { name: 'run', duration: 0, cases }, placements: [] },
    ];

    const [run] = createRuns(
      PLUGIN,
      ruleResults([], diagnostics),
      [rule],
      FORMAT,
    );
    const stepExecution = run!.executions![0]!.children![0]!.children![0]!;
    expect(stepExecution.httpTransactions).toHaveLength(1);
  });

  it('places a step-level violation on the correct step', () => {
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
    );
    const testCaseExecution = run!.executions![0]!.children![0]!;
    expect(testCaseExecution.children![0]!.findings).toHaveLength(0); // step 1: no violation
    expect(testCaseExecution.children![1]!.findings[0]!.kind).toBe(
      'rule-violation',
    ); // step 2: has violation
  });

  it('places a test-case-level placement on the case, not a step', () => {
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
    );
    const testCaseExecution = run!.executions![0]!.children![0]!;
    // test-case-pass finding + rule-violation from test-case-level placement
    expect(testCaseExecution.findings).toHaveLength(2);
    expect(testCaseExecution.findings[1]!.kind).toBe('rule-violation');
    // step has no violation
    expect(testCaseExecution.children![0]!.findings).toHaveLength(0);
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
    );
    const ruleExecution = run!.executions![0]!;
    // only the one test-case child, no extra fallback child
    expect(ruleExecution.children).toHaveLength(1);
    expect(ruleExecution.children![0]!.name).toBe('my-test');
  });

  it('renders unplaced results through the location-based fallback', () => {
    const cases = [makePassedCase('my-test', [])];
    const placedResult = makeResult('placed');
    const unplacedResult: RuleFnResult = {
      location: 'GET /unplaced',
      findings: [],
    };
    const placements: RuleFnResultPlacement[] = [
      { result: placedResult, testCaseIndex: 0, stepIndex: undefined },
    ];
    const diagnostics: HttpTesterRuleDiagnostics = [
      { testResult: { name: 'run', duration: 0, cases }, placements },
    ];

    const [run] = createRuns(
      PLUGIN,
      ruleResults([placedResult, unplacedResult], diagnostics),
      [rule],
      FORMAT,
    );
    const ruleExecution = run!.executions![0]!;
    // test-case child + one fallback child for the unplaced result
    expect(ruleExecution.children).toHaveLength(2);
    expect(ruleExecution.children![1]!.name).toBe('GET /unplaced');
  });

  describe('step locations', () => {
    it('uses thymianFormat edge location for a single step', () => {
      const step = makeSingleStep('tx-abc');
      const cases = [makePassedCase('my-test', [step])];
      const diagnostics: HttpTesterRuleDiagnostics = [
        { testResult: { name: 'run', duration: 0, cases }, placements: [] },
      ];

      const [run] = createRuns(
        PLUGIN,
        ruleResults([], diagnostics),
        [rule],
        FORMAT,
      );
      const stepExecution = run!.executions![0]!.children![0]!.children![0]!;
      expect(stepExecution.location).toEqual({
        type: 'thymianFormat',
        elementType: 'edge',
        elementId: 'tx-abc',
        pointer: '',
      });
    });

    it('uses custom key location for a grouped step', () => {
      const step = makeGroupedStep('my-group');
      const cases = [makePassedCase('my-test', [step])];
      const diagnostics: HttpTesterRuleDiagnostics = [
        { testResult: { name: 'run', duration: 0, cases }, placements: [] },
      ];

      const [run] = createRuns(
        PLUGIN,
        ruleResults([], diagnostics),
        [rule],
        FORMAT,
      );
      const stepExecution = run!.executions![0]!.children![0]!.children![0]!;
      expect(stepExecution.location).toEqual({
        type: 'custom',
        value: 'my-group',
      });
    });

    it('uses JSON-stringified location for a custom step with object source', () => {
      const step = makeCustomStep({ method: 'GET', path: '/test' });
      const cases = [makePassedCase('my-test', [step])];
      const diagnostics: HttpTesterRuleDiagnostics = [
        { testResult: { name: 'run', duration: 0, cases }, placements: [] },
      ];

      const [run] = createRuns(
        PLUGIN,
        ruleResults([], diagnostics),
        [rule],
        FORMAT,
      );
      const stepExecution = run!.executions![0]!.children![0]!.children![0]!;
      expect(stepExecution.location).toEqual({
        type: 'custom',
        value: JSON.stringify({ method: 'GET', path: '/test' }),
      });
    });

    it('uses stringified location for a custom step with primitive source', () => {
      const step = makeCustomStep('my-primitive-source');
      const cases = [makePassedCase('my-test', [step])];
      const diagnostics: HttpTesterRuleDiagnostics = [
        { testResult: { name: 'run', duration: 0, cases }, placements: [] },
      ];

      const [run] = createRuns(
        PLUGIN,
        ruleResults([], diagnostics),
        [rule],
        FORMAT,
      );
      const stepExecution = run!.executions![0]!.children![0]!.children![0]!;
      expect(stepExecution.location).toEqual({
        type: 'custom',
        value: 'my-primitive-source',
      });
    });
  });
});
