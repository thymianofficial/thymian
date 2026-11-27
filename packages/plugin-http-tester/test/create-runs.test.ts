import {
  and,
  createHttpTestContext,
  type HttpRequestTemplate,
  type HttpResponse,
  httpRule,
  type HttpTestCase,
  type HttpTestCaseStep,
  locateOnGroup,
  type Logger,
  method,
  NoopLogger,
  responseHeader,
  type Rule,
  type RuleFnResult,
  type RuleRunnerAdapter,
  type RuleViolationGroupLocation,
  type RuleViolationLocation,
  runRules,
  singleTestCase,
  statusCode,
  type TestCaseExecution,
  ThymianFormat,
  type ThymianHttpTransaction,
} from '@thymian/core';
import {
  createCreatedResponse,
  createHttpRequest,
  createHttpResponse,
  createPostRequest,
  createRequiredParameter,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { describe, expect, it, vi } from 'vitest';

import {
  createRuns,
  HttpTestApiContext,
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

/** A step whose executed transaction carries `transactionId` as its edge id. */
function makeEdgeStep(transactionId: string, path = '/x'): HttpTestCaseStep {
  return {
    type: 'single',
    source: { transactionId },
    transactions: [
      {
        request: { origin: 'http://localhost', path, method: 'GET' },
        response: { statusCode: 200, headers: {} },
        source: { transactionId },
      },
    ],
  } as unknown as HttpTestCaseStep;
}

function hasViolation(step: { findings: { kind: string }[] }): boolean {
  return step.findings.some((f) => f.kind === 'rule-violation');
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
  ruleFnResult: RuleFnResult<
    RuleViolationLocation | RuleViolationGroupLocation
  >[],
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
    const diagnostics: HttpTesterRuleDiagnostics = {
      calls: [{ testResult: { name: 'run', duration: 0, cases }, placements }],
    };

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
    const diagnostics: HttpTesterRuleDiagnostics = {
      calls: [
        { testResult: { name: 'run', duration: 0, cases }, placements: [] },
      ],
    };

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
    const diagnostics: HttpTesterRuleDiagnostics = {
      calls: [{ testResult: { name: 'run', duration: 0, cases }, placements }],
    };

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

  it('keeps a distinct violation.message on the step even when failure detail exists', () => {
    // A rule result that carries BOTH its own rationale (violation.message) and
    // an assertion-failure finding: the rationale must not be suppressed by the
    // presence of the detail — both should reach the step.
    const result: RuleFnResult = {
      location: { elementType: 'edge', elementId: 'tx-1' },
      violation: { message: 'rule-specific rationale' },
      findings: [{ kind: 'assertion-failure', title: 'value mismatch' }],
    };
    const cases = [makePassedCase('failing-test', [makeStep()])];
    const placements: RuleFnResultPlacement[] = [
      { result, testCaseIndex: 0, stepIndex: 0 },
    ];
    const diagnostics: HttpTesterRuleDiagnostics = {
      calls: [{ testResult: { name: 'run', duration: 0, cases }, placements }],
    };

    const [run] = createRuns(
      PLUGIN,
      ruleResults([result], diagnostics),
      [rule],
      FORMAT,
      makeLogger(),
    );

    const stepFindings = testCases(run!.executions)[0]!.steps[0]!.findings;
    expect(stepFindings.some((f) => f.kind === 'assertion-failure')).toBe(true);
    const marker = stepFindings.find((f) => f.kind === 'rule-violation');
    expect(marker).toBeDefined();
    expect(marker!.message?.text).toBe('rule-specific rationale');
  });

  it('suppresses the generic marker when detail exists and the violation has no message', () => {
    // The common case: an empty violation (no distinct rationale) alongside an
    // assertion-failure detail should NOT add a duplicate generic marker.
    const result: RuleFnResult = {
      location: { elementType: 'edge', elementId: 'tx-1' },
      violation: {},
      findings: [{ kind: 'assertion-failure', title: 'value mismatch' }],
    };
    const cases = [makePassedCase('failing-test', [makeStep()])];
    const placements: RuleFnResultPlacement[] = [
      { result, testCaseIndex: 0, stepIndex: 0 },
    ];
    const diagnostics: HttpTesterRuleDiagnostics = {
      calls: [{ testResult: { name: 'run', duration: 0, cases }, placements }],
    };

    const [run] = createRuns(
      PLUGIN,
      ruleResults([result], diagnostics),
      [rule],
      FORMAT,
      makeLogger(),
    );

    const stepFindings = testCases(run!.executions)[0]!.steps[0]!.findings;
    expect(stepFindings.some((f) => f.kind === 'rule-violation')).toBe(false);
    expect(stepFindings.some((f) => f.kind === 'assertion-failure')).toBe(true);
  });

  it('renders every distinct violation message on a step, not just the first', () => {
    // Two violation-bearing placements land on the same step (e.g. two failing
    // transactions in one grouped step). Both messages must reach the step —
    // selecting only the first would silently drop the second's rationale.
    const first = makeResult('first violation');
    const second = makeResult('second violation');
    const cases = [makePassedCase('my-test', [makeStep()])];
    const placements: RuleFnResultPlacement[] = [
      { result: first, testCaseIndex: 0, stepIndex: 0 },
      { result: second, testCaseIndex: 0, stepIndex: 0 },
    ];
    const diagnostics: HttpTesterRuleDiagnostics = {
      calls: [{ testResult: { name: 'run', duration: 0, cases }, placements }],
    };

    const [run] = createRuns(
      PLUGIN,
      ruleResults([first, second], diagnostics),
      [rule],
      FORMAT,
      makeLogger(),
    );
    const messages = testCases(run!.executions)[0]!
      .steps[0]!.findings.filter((f) => f.kind === 'rule-violation')
      .map((f) => f.message?.text);
    expect(messages).toContain('first violation');
    expect(messages).toContain('second violation');
  });

  it('collapses identical violation messages on a step to a single marker', () => {
    const a = makeResult('same message');
    const b = makeResult('same message');
    const cases = [makePassedCase('my-test', [makeStep()])];
    const placements: RuleFnResultPlacement[] = [
      { result: a, testCaseIndex: 0, stepIndex: 0 },
      { result: b, testCaseIndex: 0, stepIndex: 0 },
    ];
    const diagnostics: HttpTesterRuleDiagnostics = {
      calls: [{ testResult: { name: 'run', duration: 0, cases }, placements }],
    };

    const [run] = createRuns(
      PLUGIN,
      ruleResults([a, b], diagnostics),
      [rule],
      FORMAT,
      makeLogger(),
    );
    expect(
      testCases(run!.executions)[0]!.steps[0]!.findings.filter(
        (f) => f.kind === 'rule-violation',
      ),
    ).toHaveLength(1);
  });

  it('maps a failed case WITHOUT a violation to skipped (a rule or framework defect)', () => {
    const cases = [makeFailedCase('failing-test', 'x is not a function')];
    const diagnostics: HttpTesterRuleDiagnostics = {
      calls: [
        { testResult: { name: 'run', duration: 0, cases }, placements: [] },
      ],
    };

    const [run] = createRuns(
      PLUGIN,
      ruleResults([], diagnostics),
      [rule],
      FORMAT,
      makeLogger(),
    );
    expect(testCases(run!.executions)[0]!.status).toMatchObject({
      kind: 'skipped',
      reason: 'x is not a function',
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
    const diagnostics: HttpTesterRuleDiagnostics = {
      calls: [{ testResult: { name: 'run', duration: 0, cases }, placements }],
    };

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
    const diagnostics: HttpTesterRuleDiagnostics = {
      calls: [
        { testResult: { name: 'run', duration: 0, cases }, placements: [] },
      ],
    };

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
    const diagnostics: HttpTesterRuleDiagnostics = {
      calls: [
        { testResult: { name: 'run', duration: 0, cases }, placements: [] },
      ],
    };

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
    const diagnostics: HttpTesterRuleDiagnostics = {
      calls: [
        { testResult: { name: 'run', duration: 0, cases }, placements: [] },
      ],
    };

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
    const diagnostics: HttpTesterRuleDiagnostics = {
      calls: [{ testResult: { name: 'run', duration: 0, cases }, placements }],
    };

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
    const diagnostics: HttpTesterRuleDiagnostics = {
      calls: [{ testResult: { name: 'run', duration: 0, cases }, placements }],
    };

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
    const diagnostics: HttpTesterRuleDiagnostics = {
      calls: [{ testResult: { name: 'run', duration: 0, cases }, placements }],
    };

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
    const diagnostics: HttpTesterRuleDiagnostics = {
      calls: [{ testResult: { name: 'run', duration: 0, cases }, placements }],
    };

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
    const diagnostics: HttpTesterRuleDiagnostics = {
      calls: [
        { testResult: { name: 'run', duration: 0, cases }, placements: [] },
      ],
    };

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

  describe('when an unplaced result references an edge that ran more than once', () => {
    const edgeResult = (): RuleFnResult => ({
      location: { elementType: 'edge', elementId: 'tx-7' },
      violation: { message: 'replayed request broke the rule' },
      findings: [],
    });
    it('attaches it to the last step of the case, where the replayed probe ran', () => {
      const cases: HttpTestCase[] = [
        makePassedCase('GET /x replayed', [
          makeEdgeStep('tx-7', '/original'),
          makeEdgeStep('tx-7', '/replayed'),
        ]),
      ];
      const diagnostics: HttpTesterRuleDiagnostics = {
        calls: [
          { testResult: { name: 'run', duration: 0, cases }, placements: [] },
        ],
      };

      const [run] = createRuns(
        PLUGIN,
        ruleResults([edgeResult()], diagnostics),
        [rule],
        FORMAT,
        makeLogger(),
      );
      const [testCase] = testCases(run!.executions);

      expect(hasViolation(testCase!.steps[1]!)).toBe(true);
      expect(hasViolation(testCase!.steps[0]!)).toBe(false);
    });

    it('keeps it in the first case that ran the edge', () => {
      const cases: HttpTestCase[] = [
        makePassedCase('first case', [makeEdgeStep('tx-7', '/first')]),
        // Two steps, so a later case's own replay cannot pull the finding over.
        makePassedCase('second case', [
          makeEdgeStep('tx-7', '/second'),
          makeEdgeStep('tx-7', '/second-replayed'),
        ]),
      ];
      const diagnostics: HttpTesterRuleDiagnostics = {
        calls: [
          { testResult: { name: 'run', duration: 0, cases }, placements: [] },
        ],
      };

      const [run] = createRuns(
        PLUGIN,
        ruleResults([edgeResult()], diagnostics),
        [rule],
        FORMAT,
        makeLogger(),
      );
      const [first, second] = testCases(run!.executions);

      expect(first!.name).toBe('first case');
      expect(first!.status.kind).toBe('failed');
      expect(hasViolation(first!.steps[0]!)).toBe(true);
      expect(second!.name).toBe('second case');
      expect(second!.status.kind).not.toBe('failed');
      expect(second!.steps.some(hasViolation)).toBe(false);
    });
  });

  it('does not leak a placement from one diagnostics entry into another', () => {
    // A rule makes two context calls that both run `tx-1`: a passing validate*()
    // (entry A, no placement recorded) and a failing httpTest() (entry B, which
    // places the failing result). The failure must render ONLY in entry B — the
    // shared `ruleFnResult` must not be synthesized into entry A, which would
    // flip its passing case to failed AND double-report the single failure.
    const failing: RuleFnResult = {
      location: { elementType: 'edge', elementId: 'tx-1' },
      violation: { message: 'assertion failed in entry B' },
      findings: [],
    };
    const diagnostics: HttpTesterRuleDiagnostics = {
      calls: [
        {
          testResult: {
            name: 'validate',
            duration: 0,
            cases: [makePassedCase('case-a', [makeEdgeStep('tx-1')])],
          },
          placements: [],
        },
        {
          testResult: {
            name: 'httpTest',
            duration: 0,
            cases: [makePassedCase('case-b', [makeEdgeStep('tx-1')])],
          },
          placements: [{ result: failing, testCaseIndex: 0, stepIndex: 0 }],
        },
      ],
    };

    const [run] = createRuns(
      PLUGIN,
      ruleResults([failing], diagnostics),
      [rule],
      FORMAT,
      makeLogger(),
    );
    const cases = testCases(run!.executions);
    expect(cases).toHaveLength(2);

    const caseA = cases.find((c) => c.name === 'case-a')!;
    const caseB = cases.find((c) => c.name === 'case-b')!;

    // entry A's case stays passed — the failure belongs to entry B.
    expect(caseA.status.kind).toBe('passed');
    expect(caseA.steps.some(hasViolation)).toBe(false);

    // entry B renders the failure exactly once.
    expect(caseB.status.kind).toBe('failed');
    expect(
      caseB.steps
        .flatMap((s) => s.findings)
        .filter((f) => f.kind === 'rule-violation'),
    ).toHaveLength(1);
  });

  describe('step locations', () => {
    function stepLocationFor(step: HttpTestCaseStep) {
      const cases = [makePassedCase('my-test', [step])];
      const diagnostics: HttpTesterRuleDiagnostics = {
        calls: [
          { testResult: { name: 'run', duration: 0, cases }, placements: [] },
        ],
      };
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

    it('reports a result located on a group as its failed test case, on the group key', () => {
      const [result] = locateOnGroup(
        [
          {
            location: 'my-group',
            violation: { message: 'flagged' },
            findings: [],
          },
        ],
        'my-group',
        [{ elementType: 'edge', elementId: 'tx-1' }],
      );
      const diagnostics: HttpTesterRuleDiagnostics = {
        calls: [
          {
            testResult: {
              name: 'test',
              cases: [makePassedCase('case', [makeGroupedStep('my-group')])],
            } as never,
            placements: [{ result: result!, testCaseIndex: 0, stepIndex: 0 }],
          },
        ],
      };

      const [run] = createRuns(
        PLUGIN,
        ruleResults([result!], diagnostics),
        [rule],
        FORMAT,
        makeLogger(),
      );

      expect(testCases(run?.executions)).toMatchObject([
        {
          status: { kind: 'failed', reason: 'flagged' },
          steps: [{ location: { type: 'custom', value: 'my-group' } }],
        },
      ]);
      expect(testCases(run?.executions)).toHaveLength(1);
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

  describe('a named-form rule-context call whose live status differs from the declared one', () => {
    async function runContext(
      liveStatus: number,
      call: (context: HttpTestApiContext) => Promise<RuleFnResult[]>,
    ): Promise<TestCaseExecution> {
      const format = new ThymianFormat();
      format.addHttpTransaction(
        createHttpRequest({ method: 'GET', path: '/users' }),
        createHttpResponse({ statusCode: 401 }),
        'test-source',
      );
      const context = new HttpTestApiContext(
        rule.meta.name,
        createHttpTestContext({
          format,
          logger: new NoopLogger(),
          locals: {},
          sampleRequest: async () => ({
            method: 'GET',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
            pathParameters: {},
            query: {},
            cookies: {},
            authorize: false,
          }),
          runRequest: async () => ({
            statusCode: liveStatus,
            headers: {},
            trailers: {},
            duration: 0,
          }),
          runHook: async (_name, hook) => ({ result: hook.value }),
        }),
      );

      const ruleFnResult = await call(context);
      const [run] = createRuns(
        PLUGIN,
        ruleResults(ruleFnResult, context.getRuleExecutionDiagnostics()),
        [rule],
        format,
        makeLogger(),
      );

      expect(testCases(run!.executions)).toHaveLength(1);
      return testCases(run!.executions)[0]!;
    }

    it('reports a pair the live re-check rejects as notApplicable, with a reason naming both statuses', async () => {
      let returned: RuleFnResult[] | undefined;
      const execution = await runContext(200, async (context) => {
        returned = await context.validateCommonHttpTransactions({
          appliesTo: statusCode(401),
          violatedWhen: responseHeader('www-authenticate'),
        });
        return returned;
      });

      expect(returned).toEqual([]);
      expect(execution.status).toMatchObject({
        kind: 'notApplicable',
        reason: expect.stringContaining(
          'the specification declares 401, the server answered 200',
        ),
      });
    });

    it('reports a judged pair with an informational status-drift finding that does not fail it', async () => {
      const execution = await runContext(501, (context) =>
        context.validateCommonHttpTransactions({
          appliesTo: method('GET'),
          violatedWhen: responseHeader('www-authenticate'),
        }),
      );

      expect(execution.status.kind).toBe('passed');
      expect(execution.steps[0]!.findings).toEqual([
        expect.objectContaining({
          kind: 'informational',
          title: 'Status drift',
          message: {
            text: expect.stringContaining(
              'the specification declares 401, the server answered 501',
            ),
          },
          transactionIndex: 0,
        }),
      ]);
    });

    it('keeps the status-drift finding next to a violation', async () => {
      const execution = await runContext(501, (context) =>
        context.validateCommonHttpTransactions({
          appliesTo: method('GET'),
          violatedWhen: statusCode(501),
        }),
      );

      expect(execution.status.kind).toBe('failed');
      expect(execution.steps[0]!.findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'rule-violation' }),
          expect.objectContaining({ kind: 'informational' }),
        ]),
      );
    });
  });
});

describe('createRuns: a rule that applies to nothing (ADR-0030)', () => {
  const createdWithLocation = () =>
    createCreatedResponse({
      headers: { location: createRequiredParameter() },
    });

  // Two 201 transactions on example.com, one of which the server answers
  // without the Location header it declares.
  const format = () =>
    createThymianFormatWithTransactions([
      [
        createPostRequest({ path: '/launches', host: 'example.com' }),
        createdWithLocation(),
      ],
      [
        createPostRequest({ path: '/astronauts', host: 'example.com' }),
        createdWithLocation(),
      ],
    ]);

  const liveResponse = (path: string): HttpResponse => ({
    statusCode: 201,
    duration: 0,
    trailers: {},
    headers: path === '/launches' ? {} : { location: '/astronauts/1' },
  });

  async function executionsOf(
    rule: Rule,
    options: { skipOrigins?: string[]; format?: ThymianFormat } = {},
  ): Promise<TestCaseExecution[]> {
    const thymianFormat = options.format ?? format();
    const context = createHttpTestContext({
      format: thymianFormat,
      logger: new NoopLogger(),
      locals: {},
      sampleRequest: async (transaction): Promise<HttpRequestTemplate> => ({
        method: transaction.thymianReq.method,
        origin: 'https://example.com',
        path: transaction.thymianReq.path,
        headers: {},
        pathParameters: {},
        query: {},
        cookies: {},
        authorize: true,
      }),
      runRequest: async (request) => liveResponse(request.path),
      runHook: async (_name, hook) =>
        ({ result: (hook as { value: unknown }).value }) as never,
    });
    const adapter: RuleRunnerAdapter<
      HttpTestApiContext,
      HttpTesterRuleDiagnostics
    > = {
      errorName: 'TestLinterError',
      mode: 'test',
      getRuleFn: (r) => r.testRule,
      createContext: (r) =>
        new HttpTestApiContext(r.meta.name, context, options.skipOrigins),
    };
    const logger = new NoopLogger();
    const results = await runRules(logger, [rule], thymianFormat, {}, adapter);
    const [run] = createRuns(PLUGIN, results, [rule], thymianFormat, logger);

    return testCases(run!.executions);
  }

  const validating = (appliesTo: Parameters<typeof and>[0]) =>
    httpRule('test/applicability')
      .severity('error')
      .type('test')
      .rule((ctx) =>
        ctx.validateCommonHttpTransactions({
          appliesTo,
          violatedWhen: () => [],
        }),
      )
      .done();

  it('reports a rule that matches no transaction as one notApplicable execution', async () => {
    const executions = await executionsOf(validating(statusCode(405)));

    expect(executions).toEqual([
      {
        kind: 'test',
        ruleId: 'test/applicability',
        name: 'no applicable transaction',
        status: {
          kind: 'notApplicable',
          reason: 'The input has no transaction this rule applies to.',
        },
        steps: [],
      },
    ]);
  });

  it('names skipOrigins as the cause when it removed every match', async () => {
    const executions = await executionsOf(validating(statusCode(201)), {
      skipOrigins: ['https://example.com'],
    });

    expect(executions).toEqual([
      expect.objectContaining({
        status: {
          kind: 'notApplicable',
          reason:
            'skipOrigins excluded every transaction this rule applies to.',
        },
        steps: [],
      }),
    ]);
  });

  it('names the input as the cause when skipOrigins removed nothing the rule applies to', async () => {
    const executions = await executionsOf(validating(statusCode(405)), {
      skipOrigins: ['https://example.com'],
    });

    expect(executions.map(({ status }) => status)).toEqual([
      {
        kind: 'notApplicable',
        reason: 'The input has no transaction this rule applies to.',
      },
    ]);
  });

  it('reports a rule that makes no rule-context call and returns nothing as notApplicable', async () => {
    const executions = await executionsOf(
      httpRule('test/applicability')
        .severity('error')
        .type('test')
        .rule(() => [])
        .done(),
    );

    expect(executions.map(({ status }) => status.kind)).toEqual([
      'notApplicable',
    ]);
  });

  it('surfaces a result that could not be placed instead of a notApplicable execution', async () => {
    const executions = await executionsOf(
      httpRule('test/applicability')
        .severity('error')
        .type('test')
        .rule(() => [
          { location: 'somewhere', violation: { message: 'x' }, findings: [] },
        ])
        .done(),
    );

    expect(executions.map(({ status }) => status.kind)).toEqual(['failed']);
  });

  it('is notApplicable, not passed, on a case whose live response appliesTo rejects', async () => {
    const executions = await executionsOf(
      validating(and(statusCode(201), responseHeader('location'))),
    );

    expect(executions.map(({ name, status }) => [name, status])).toEqual([
      [
        expect.stringContaining('/launches'),
        {
          kind: 'notApplicable',
          reason: "The live pair is outside the rule's applicability.",
        },
      ],
      [
        expect.stringContaining('/astronauts'),
        expect.objectContaining({ kind: 'passed' }),
      ],
    ]);
  });

  it('judges a partly rejected case on the transactions it did judge', async () => {
    const judged: string[] = [];
    const executions = await executionsOf(
      httpRule('test/applicability')
        .severity('error')
        .type('test')
        .rule((ctx) =>
          ctx.validateGroupedCommonHttpTransactions({
            appliesTo: and(statusCode(201), responseHeader('location')),
            groupBy: method(),
            violatedWhen: (_key, transactions) => {
              judged.push(...transactions.map(([req]) => req.path));
              return transactions.map(([, , location]) => ({
                location,
                violation: { message: 'judged' },
                findings: [],
              }));
            },
          }),
        )
        .done(),
    );

    expect(judged).toEqual(['/astronauts']);
    expect(executions.map(({ status }) => status.kind)).toEqual(['failed']);
  });

  it('is notApplicable on a grouped case whose every live response appliesTo rejects', async () => {
    const executions = await executionsOf(
      httpRule('test/applicability')
        .severity('error')
        .type('test')
        .rule((ctx) =>
          ctx.validateGroupedCommonHttpTransactions({
            appliesTo: and(statusCode(201), responseHeader('x-never')),
            groupBy: method(),
            violatedWhen: (_key, transactions) =>
              transactions.map(([, , location]) => ({
                location,
                violation: {},
                findings: [],
              })),
          }),
        )
        .done(),
      {
        format: createThymianFormatWithTransactions([
          [
            createPostRequest({ path: '/launches', host: 'example.com' }),
            createCreatedResponse({
              headers: { 'x-never': createRequiredParameter() },
            }),
          ],
        ]),
      },
    );

    expect(executions.map(({ status }) => status)).toEqual([
      {
        kind: 'notApplicable',
        reason: "No live pair of the group is inside the rule's applicability.",
      },
    ]);
  });

  it('never marks a case of a bespoke ctx.httpTest pipeline notApplicable', async () => {
    const executions = await executionsOf(
      httpRule('test/applicability')
        .severity('error')
        .type('test')
        .rule((ctx) =>
          ctx.httpTest(
            singleTestCase().forTransactionsWith(statusCode(201)).run().done(),
          ),
        )
        .done(),
    );

    expect(executions.map(({ status }) => status.kind)).toEqual([
      'passed',
      'passed',
    ]);
  });
});

/**
 * A test case the pipeline failed is a violation only when an assertion
 * failed: a hook's fail verdict records one, a defect in the rule does not and
 * stays skipped (ADR-0031).
 */
describe("createRuns: a hook's fail verdict and a rule defect", () => {
  const sending = httpRule('test/sending')
    .severity('error')
    .type('test')
    .rule(async (ctx) =>
      ctx.httpTest(
        singleTestCase()
          .forTransactionsWith(method('GET'))
          .run({ checkStatusCode: false })
          .done(),
      ),
    )
    .done();

  async function executionsOf(
    rule: Rule,
    fail: { beforeRequest?: string; afterResponse?: string } = {},
  ): Promise<TestCaseExecution[]> {
    const thymianFormat = createThymianFormatWithTransactions([
      [
        createHttpRequest({ method: 'GET', path: '/users' }),
        createHttpResponse({ statusCode: 200 }),
      ],
    ]);
    const context = createHttpTestContext({
      format: thymianFormat,
      logger: new NoopLogger(),
      locals: {},
      sampleRequest: async (transaction): Promise<HttpRequestTemplate> => ({
        method: transaction.thymianReq.method,
        origin: 'https://api.example.com',
        path: transaction.thymianReq.path,
        headers: {},
        pathParameters: {},
        query: {},
        cookies: {},
        authorize: false,
      }),
      runRequest: async () => ({
        statusCode: 200,
        headers: {},
        trailers: {},
        duration: 0,
      }),
      runHook: async (name, hook) =>
        ({
          result: (hook as { value: unknown }).value,
          fail: name === 'authorize' ? undefined : fail[name],
        }) as never,
    });
    const adapter: RuleRunnerAdapter<
      HttpTestApiContext,
      HttpTesterRuleDiagnostics
    > = {
      errorName: 'TestLinterError',
      mode: 'test',
      getRuleFn: (r) => r.testRule,
      createContext: (r) => new HttpTestApiContext(r.meta.name, context),
    };
    const logger = new NoopLogger();
    const results = await runRules(logger, [rule], thymianFormat, {}, adapter);
    const [run] = createRuns(PLUGIN, results, [rule], thymianFormat, logger);

    return testCases(run!.executions);
  }

  it('reports a beforeRequest hook fail as a failed execution with its message as reason', async () => {
    const executions = await executionsOf(sending, {
      beforeRequest: 'precondition violated',
    });

    expect(executions.map(({ status }) => status)).toEqual([
      expect.objectContaining({
        kind: 'failed',
        reason: 'precondition violated',
      }),
    ]);
  });

  it('reports an afterResponse hook fail as a failed execution, located on the transaction it judged', async () => {
    const executions = await executionsOf(sending, {
      afterResponse: 'response is wrong',
    });

    expect(executions.map(({ status }) => status)).toEqual([
      expect.objectContaining({ kind: 'failed', reason: 'response is wrong' }),
    ]);
    expect(executions[0]!.steps[0]!.findings).toContainEqual(
      expect.objectContaining({
        kind: 'assertion-failure',
        transactionIndex: 0,
      }),
    );
  });

  it('reports a .transactions() callback that throws a TypeError as skipped with its reason', async () => {
    const executions = await executionsOf(
      httpRule('test/defect')
        .severity('error')
        .type('test')
        .rule(async (ctx) =>
          ctx.httpTest(
            singleTestCase()
              .forTransactionsWith(method('GET'))
              .run({ checkStatusCode: false })
              .transactions(() => {
                throw new TypeError('cannot read properties of undefined');
              })
              .done(),
          ),
        )
        .done(),
    );

    expect(executions.map(({ status }) => status)).toEqual([
      { kind: 'skipped', reason: 'cannot read properties of undefined' },
    ]);
  });
});
