import { describe, expect, it, vi } from 'vitest';

import type {
  Location,
  ReportDiffSide,
  RuleChange,
  RunResultChange,
  SpecificationChange,
  ThymianHttpRequest,
  ThymianHttpResponse,
  ToolRun,
} from '../src/index.js';
import {
  ajv,
  computeReportDiff,
  createLintExecution,
  createReportDiff,
  createTestCaseExecution,
  createToolRun,
  matchEndpoints,
  reportDiffSchema,
  ThymianFormat,
} from '../src/index.js';

function request(
  overrides: Partial<ThymianHttpRequest> = {},
): Omit<ThymianHttpRequest, 'label' | 'sourceName'> {
  return {
    type: 'http-request',
    host: 'localhost',
    port: 443,
    protocol: 'https',
    path: '/users',
    method: 'GET',
    headers: {},
    queryParameters: {},
    cookies: {},
    pathParameters: {},
    mediaType: '',
    ...overrides,
  };
}

function response(
  overrides: Partial<ThymianHttpResponse> = {},
): Omit<ThymianHttpResponse, 'label' | 'sourceName'> {
  return {
    type: 'http-response',
    headers: {},
    mediaType: 'application/json',
    statusCode: 200,
    ...overrides,
  };
}

/** Build a serialized single-endpoint format and return it with its ids. */
function serializedFormat(
  transactions: {
    request: Omit<ThymianHttpRequest, 'label' | 'sourceName'>;
    response: Omit<ThymianHttpResponse, 'label' | 'sourceName'>;
  }[],
) {
  const format = new ThymianFormat();
  const ids = transactions.map(({ request: req, response: res }) =>
    format.addHttpTransaction(req, res, 'test-source'),
  );
  const serialized = format.export();

  return { serialized, hash: serialized.attributes.hash, ids };
}

function side(
  overrides: Partial<ReportDiffSide> & { runs: ToolRun[] },
): ReportDiffSide {
  return {
    reportId: 'report-base',
    createdAt: '2026-08-26T00:00:00.000Z',
    ...overrides,
  };
}

function failedLintRun(opts: {
  location: Location;
  ruleId?: string;
  reason?: string;
  rules?: ToolRun['rules'];
  thymianFormatVersion?: string;
  runId?: string;
}): ToolRun {
  const run = createToolRun({
    tool: { name: 'test-linter' },
    runType: 'lint',
    executions: [
      createLintExecution({
        location: opts.location,
        status: {
          kind: 'failed',
          ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
        },
        ...(opts.ruleId !== undefined ? { ruleId: opts.ruleId } : {}),
      }),
    ],
    rules: opts.rules,
    thymianFormatVersion: opts.thymianFormatVersion,
  });

  return { ...run, runId: opts.runId ?? run.runId };
}

const fileLocation: Location = { type: 'file', path: 'api.yaml', line: 3 };

describe('report diff document', () => {
  it('mints the envelope and copies both side identities', () => {
    const diff = createReportDiff(
      { reportId: 'base-id', createdAt: '2026-01-01T00:00:00.000Z' },
      { reportId: 'head-id', createdAt: '2026-02-01T00:00:00.000Z' },
      [],
    );

    expect(diff.diffId).toMatch(/[0-9a-f-]{36}/);
    expect(Date.parse(diff.createdAt)).not.toBeNaN();
    expect(diff.baseReportId).toBe('base-id');
    expect(diff.headReportId).toBe('head-id');
    expect(diff.baseCreatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(diff.headCreatedAt).toBe('2026-02-01T00:00:00.000Z');
    expect(diff.changes).toEqual([]);

    const validate = ajv.compile(reportDiffSchema);
    expect(validate(diff)).toBe(true);
  });

  it('schema rejects a missing envelope field and unknown discriminators', () => {
    const validate = ajv.compile(reportDiffSchema);
    const valid = createReportDiff(
      { reportId: 'b', createdAt: 'x' },
      { reportId: 'h', createdAt: 'y' },
      [],
    );

    const { baseReportId: _dropped, ...missingField } = valid;
    expect(validate(missingField)).toBe(false);

    expect(
      validate({
        ...valid,
        changes: [{ kind: 'nonsense', change: 'added' }],
      }),
    ).toBe(false);
    expect(
      validate({
        ...valid,
        changes: [{ kind: 'rule', change: 'mutated' }],
      }),
    ).toBe(false);
  });
});

describe('matchEndpoints', () => {
  it('reports identical sides as unchanged', () => {
    const base = serializedFormat([
      { request: request(), response: response() },
    ]);
    const head = serializedFormat([
      { request: request(), response: response() },
    ]);

    const result = matchEndpoints(
      { [base.hash]: base.serialized },
      { [head.hash]: head.serialized },
    );

    expect(result.changes).toEqual([]);
    expect(result.baseHasFormat).toBe(true);
    expect(result.headHasFormat).toBe(true);
  });

  it('classifies added and removed endpoints by natural key', () => {
    const base = serializedFormat([
      { request: request(), response: response() },
    ]);
    const head = serializedFormat([
      { request: request(), response: response() },
      {
        request: request({ method: 'POST' }),
        response: response({ statusCode: 201 }),
      },
    ]);

    const result = matchEndpoints(
      { [base.hash]: base.serialized },
      { [head.hash]: head.serialized },
    );

    expect(result.changes).toEqual([
      {
        kind: 'specification',
        change: 'added',
        endpoint: 'POST /users',
        method: 'POST',
        path: '/users',
      },
    ]);

    const reversed = matchEndpoints(
      { [head.hash]: head.serialized },
      { [base.hash]: base.serialized },
    );
    expect(reversed.changes).toEqual([
      expect.objectContaining({ change: 'removed', endpoint: 'POST /users' }),
    ]);
  });

  it('pairs a changed endpoint by method+path and names the changed aspects', () => {
    const base = serializedFormat([
      { request: request(), response: response() },
    ]);
    const head = serializedFormat([
      {
        request: request({
          queryParameters: { page: { schema: { type: 'integer' } } },
        } as Partial<ThymianHttpRequest>),
        response: response(),
      },
    ]);

    const result = matchEndpoints(
      { [base.hash]: base.serialized },
      { [head.hash]: head.serialized },
    );

    expect(result.changes).toEqual([
      {
        kind: 'specification',
        change: 'changed',
        endpoint: 'GET /users',
        method: 'GET',
        path: '/users',
        changedAspects: ['queryParameters'],
      },
    ]);

    const [baseRequestId] = base.ids[0]!;
    const [headRequestId] = head.ids[0]!;
    expect(baseRequestId).not.toBe(headRequestId);
    expect(result.headToBaseElementIds.get(headRequestId)).toBe(baseRequestId);
  });

  it('detects response-only changes as the responses aspect', () => {
    const base = serializedFormat([
      { request: request(), response: response() },
    ]);
    const head = serializedFormat([
      { request: request(), response: response({ statusCode: 404 }) },
    ]);

    const result = matchEndpoints(
      { [base.hash]: base.serialized },
      { [head.hash]: head.serialized },
    );

    expect(result.changes).toEqual([
      expect.objectContaining({
        change: 'changed',
        changedAspects: ['responses'],
      }),
    ]);
  });

  it('reports missing format maps per side', () => {
    const head = serializedFormat([
      { request: request(), response: response() },
    ]);
    const result = matchEndpoints(undefined, { [head.hash]: head.serialized });

    expect(result.baseHasFormat).toBe(false);
    expect(result.headHasFormat).toBe(true);
  });
});

describe('computeReportDiff', () => {
  it('diffs a side against itself to an empty change list', () => {
    const format = serializedFormat([
      { request: request(), response: response() },
    ]);
    const [requestId] = format.ids[0]!;
    const location: Location = {
      type: 'thymianFormat',
      elementType: 'node',
      elementId: requestId,
      pointer: '',
    };
    const makeSide = (reportId: string) =>
      side({
        reportId,
        runs: [
          failedLintRun({
            location,
            ruleId: 'rfc9110/x',
            rules: [{ id: 'rfc9110/x', severity: 'warn' }],
            thymianFormatVersion: format.hash,
            runId: 'run-1',
          }),
        ],
        thymianFormat: { [format.hash]: format.serialized },
      });

    const diff = computeReportDiff(makeSide('a'), makeSide('b'));

    expect(diff.changes).toEqual([]);
    expect(diff.baseReportId).toBe('a');
    expect(diff.headReportId).toBe('b');
  });

  it('classifies new and resolved run results with resolved severity and label', () => {
    const format = serializedFormat([
      { request: request(), response: response() },
    ]);
    const [requestId] = format.ids[0]!;
    const location: Location = {
      type: 'thymianFormat',
      elementType: 'node',
      elementId: requestId,
      pointer: '',
    };
    const rules = [{ id: 'rfc9110/x', severity: 'warn' as const }];
    const empty = side({
      reportId: 'empty',
      runs: [
        createToolRun({
          tool: { name: 'test-linter' },
          runType: 'lint',
          executions: [],
          rules,
          thymianFormatVersion: format.hash,
        }),
      ],
      thymianFormat: { [format.hash]: format.serialized },
    });
    const failing = side({
      reportId: 'failing',
      runs: [
        failedLintRun({
          location,
          ruleId: 'rfc9110/x',
          rules,
          thymianFormatVersion: format.hash,
        }),
      ],
      thymianFormat: { [format.hash]: format.serialized },
    });

    const regression = computeReportDiff(empty, failing);
    expect(regression.changes).toHaveLength(1);
    const added = regression.changes[0] as RunResultChange;
    expect(added).toMatchObject({
      kind: 'run-result',
      change: 'added',
      runType: 'lint',
      ruleId: 'rfc9110/x',
      severity: 'warn',
      locationLabel: 'GET /users',
    });

    const improvement = computeReportDiff(failing, empty);
    expect(improvement.changes).toEqual([
      expect.objectContaining({ kind: 'run-result', change: 'removed' }),
    ]);
  });

  it('surfaces a severity reconfiguration as a removed+added pair', () => {
    const baseSide = side({
      reportId: 'base',
      runs: [
        failedLintRun({
          location: fileLocation,
          ruleId: 'rfc9110/x',
          rules: [{ id: 'rfc9110/x', severity: 'warn' }],
        }),
      ],
    });
    const headSide = side({
      reportId: 'head',
      runs: [
        failedLintRun({
          location: fileLocation,
          ruleId: 'rfc9110/x',
          rules: [{ id: 'rfc9110/x', severity: 'error' }],
        }),
      ],
    });

    const diff = computeReportDiff(baseSide, headSide);
    const runResults = diff.changes.filter(
      (change) => change.kind === 'run-result',
    ) as RunResultChange[];

    expect(runResults).toHaveLength(2);
    expect(
      runResults.map((change) => [change.change, change.severity]),
    ).toEqual([
      ['added', 'error'],
      ['removed', 'warn'],
    ]);
  });

  it('keeps a finding stable across a changed endpoint via id pairing', () => {
    const baseFormat = serializedFormat([
      { request: request(), response: response() },
    ]);
    const headFormat = serializedFormat([
      {
        request: request({
          queryParameters: { page: { schema: { type: 'integer' } } },
        } as Partial<ThymianHttpRequest>),
        response: response(),
      },
    ]);
    const locationFor = (elementId: string): Location => ({
      type: 'thymianFormat',
      elementType: 'node',
      elementId,
      pointer: '',
    });
    const rules = [{ id: 'rfc9110/x', severity: 'error' as const }];

    const diff = computeReportDiff(
      side({
        reportId: 'base',
        runs: [
          failedLintRun({
            location: locationFor(baseFormat.ids[0]![0]),
            ruleId: 'rfc9110/x',
            rules,
            thymianFormatVersion: baseFormat.hash,
          }),
        ],
        thymianFormat: { [baseFormat.hash]: baseFormat.serialized },
      }),
      side({
        reportId: 'head',
        runs: [
          failedLintRun({
            location: locationFor(headFormat.ids[0]![0]),
            ruleId: 'rfc9110/x',
            rules,
            thymianFormatVersion: headFormat.hash,
          }),
        ],
        thymianFormat: { [headFormat.hash]: headFormat.serialized },
      }),
    );

    expect(diff.changes).toEqual([
      expect.objectContaining({ kind: 'specification', change: 'changed' }),
    ]);
  });

  it('groups rule changes into ruleset entries only when the whole set moved', () => {
    const baseSide = side({
      reportId: 'base',
      runs: [
        createToolRun({
          tool: { name: 'test-linter' },
          runType: 'lint',
          executions: [],
          rules: [
            { id: 'rfc9110/x', severity: 'error' },
            { id: 'oldset/a', severity: 'warn' },
            { id: 'oldset/b', severity: 'warn' },
          ],
        }),
      ],
    });
    const headSide = side({
      reportId: 'head',
      runs: [
        createToolRun({
          tool: { name: 'test-linter' },
          runType: 'lint',
          executions: [],
          rules: [
            { id: 'rfc9110/x', severity: 'error' },
            { id: 'rfc9110/y', severity: 'error', name: 'Y rule' },
            { id: 'newset/a', severity: 'warn' },
            { id: 'newset/b', severity: 'warn' },
          ],
        }),
      ],
    });

    const diff = computeReportDiff(baseSide, headSide);
    const ruleChanges = diff.changes.filter(
      (change) => change.kind === 'rule',
    ) as RuleChange[];

    expect(ruleChanges).toEqual([
      { kind: 'rule', change: 'added', scope: 'ruleset', id: 'newset' },
      {
        kind: 'rule',
        change: 'added',
        scope: 'rule',
        id: 'rfc9110/y',
        name: 'Y rule',
      },
      { kind: 'rule', change: 'removed', scope: 'ruleset', id: 'oldset' },
    ]);
  });

  it('skips specification comparison with a warning when a side has no format', () => {
    const headFormat = serializedFormat([
      { request: request(), response: response() },
    ]);
    const warn = vi.fn();
    const logger = { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() };

    const diff = computeReportDiff(
      side({ reportId: 'base', runs: [] }),
      side({
        reportId: 'head',
        runs: [],
        thymianFormat: { [headFormat.hash]: headFormat.serialized },
      }),
      logger,
    );

    const specChanges = diff.changes.filter(
      (change): change is SpecificationChange =>
        change.kind === 'specification',
    );
    expect(specChanges).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Skipping specification comparison'),
    );
  });

  it('includes the test-case name in test run-result identity', () => {
    const makeSide = (reportId: string, testName: string) =>
      side({
        reportId,
        runs: [
          createToolRun({
            tool: { name: 'test-runner' },
            runType: 'test',
            executions: [
              createTestCaseExecution({
                name: testName,
                status: { kind: 'failed' },
                ruleId: 'rfc9110/x',
              }),
            ],
            rules: [{ id: 'rfc9110/x', severity: 'error' }],
          }),
        ],
      });

    const diff = computeReportDiff(
      makeSide('base', 'old test'),
      makeSide('head', 'new test'),
    );
    const runResults = diff.changes as RunResultChange[];

    expect(
      runResults.map((change) => [change.change, change.testCase]),
    ).toEqual([
      ['added', 'new test'],
      ['removed', 'old test'],
    ]);
  });
});
