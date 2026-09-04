import {
  type HttpTestCase,
  type HttpTestCaseResult,
  type HttpTestCaseStep,
  ThymianBaseError,
  type ThymianHttpTransaction,
} from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import {
  checkedFromError,
  checkedFromTestCase,
  summaryOf,
} from '../src/cli/check-result.js';

/**
 * #48: every Transaction ends in exactly one Outcome, and a skip names the Seed
 * that caused it.
 *
 * These assert the record `sampler check` renders and `--json` emits — the
 * user-visible verdict — from real `HttpTestCase` values. The end-to-end half
 * (a run that really completes, and its exit code) is
 * `e2e-tests/src/cli-sampler-check.test.ts`.
 */
const FORMAT = createThymianFormatWithTransactions([
  [
    createHttpRequest({
      method: 'GET',
      path: '/launches/{id}',
      mediaType: '',
    }),
    createHttpResponse({ statusCode: 200, mediaType: 'application/json' }),
  ],
  [
    createHttpRequest({
      method: 'POST',
      path: '/launches',
      mediaType: 'application/json',
    }),
    createHttpResponse({ statusCode: 201, mediaType: 'application/json' }),
  ],
]);

const [CHECKED, SEED] = FORMAT.getThymianHttpTransactions() as [
  ThymianHttpTransaction,
  ThymianHttpTransaction,
];

const CHECKED_SELECTOR = 'GET /launches/{id} -> 200 (application/json)';
const SEED_SELECTOR =
  'POST /launches (application/json) -> 201 (application/json)';

function testCase(
  overrides: Partial<HttpTestCase> & {
    actualStatus?: number;
    results?: HttpTestCaseResult[];
  } = {},
): HttpTestCase {
  const { actualStatus, ...rest } = overrides;

  const step: HttpTestCaseStep = {
    type: 'single',
    source: CHECKED,
    transactions: [
      {
        requestTemplate: {} as never,
        ...(actualStatus === undefined
          ? {}
          : { response: { statusCode: actualStatus } as never }),
      },
    ],
  };

  return {
    name: CHECKED_SELECTOR,
    status: 'passed',
    start: 0,
    steps: [step],
    results: [],
    ...rest,
  };
}

/** What the runner records when a Seed is answered off-selector. */
function seedAnomaly(message: string, details: string): HttpTestCaseResult {
  return {
    type: 'invalid-transaction',
    message,
    details,
    transaction: SEED,
  };
}

describe('a transaction whose pipeline ran', () => {
  it('passes when the pipeline passed it', () => {
    expect(
      checkedFromTestCase(testCase({ actualStatus: 200 }), CHECKED),
    ).toEqual({
      selector: CHECKED_SELECTOR,
      outcome: 'passed',
      expectedStatus: 200,
      actualStatus: 200,
      details: [],
    });
  });

  it('is skipped, not failed, when the status did not match', () => {
    const mismatch = 'Expected status code 200, but received 404.';

    const result = checkedFromTestCase(
      testCase({
        status: 'skipped',
        reason: mismatch,
        actualStatus: 404,
        results: [
          {
            type: 'invalid-transaction',
            message: mismatch,
            details: 'In most cases, this is because …',
            transaction: CHECKED,
          },
        ],
      }),
      CHECKED,
    );

    expect(result.outcome).toBe('skipped');
    expect(result.actualStatus).toBe(404);
    // The reason arrives once, and the remediation beside it — not the reason
    // twice, which is what printing both the case's reason and the result it
    // was derived from used to produce.
    expect(result.reason).toBe(mismatch);
    expect(result.details).toEqual(['In most cases, this is because …']);
  });

  it('fails when an assertion failed', () => {
    const result = checkedFromTestCase(
      testCase({
        status: 'failed',
        actualStatus: 200,
        results: [
          {
            type: 'assertion-failure',
            message: 'Response body does not match the schema.',
            transaction: CHECKED,
          },
        ],
      }),
      CHECKED,
    );

    expect(result.outcome).toBe('failed');
    // The pipeline failed the case without a reason of its own, so the
    // assertion's message becomes the reason rather than a detail under it.
    expect(result.reason).toBe('Response body does not match the schema.');
    expect(result.details).toEqual([]);
  });

  it('is skipped and names the seed when a seed was answered differently', () => {
    const result = checkedFromTestCase(
      testCase({
        status: 'failed',
        actualStatus: 404,
        reason: 'Expected status code 200, but received 404.',
        results: [
          seedAnomaly(
            `The seed "${SEED_SELECTOR}" was answered with 400, not the 201 its selector names.`,
            'The specification declares that response for this operation …',
          ),
        ],
      }),
      CHECKED,
    );

    // Whatever the pipeline called the case: a transaction whose precondition
    // never happened was not executed as described.
    expect(result.outcome).toBe('skipped');
    expect(result.causedBy).toBe(SEED_SELECTOR);
    expect(result.details[0]).toContain('was answered with 400');
  });

  it('stays passed when a seed answered differently but the transaction worked', () => {
    const result = checkedFromTestCase(
      testCase({
        status: 'passed',
        actualStatus: 200,
        results: [
          seedAnomaly(
            `The seed "${SEED_SELECTOR}" was answered with 400, not the 201 its selector names.`,
            'The specification declares that response for this operation …',
          ),
        ],
      }),
      CHECKED,
    );

    expect(result.outcome).toBe('passed');
  });

  it('always says why, even when the pipeline said nothing', () => {
    // `ctx.fail(current)` with no message is a real pipeline verdict, and the
    // `--json` contract promises a reason for anything that is not passed.
    const bare = checkedFromTestCase(testCase({ status: 'failed' }), CHECKED);

    expect(bare.reason).toBe('The response did not match the description.');

    // A case with details but no reason promotes the first detail rather than
    // printing it twice.
    const detailed = checkedFromTestCase(
      testCase({
        status: 'failed',
        results: [
          {
            type: 'assertion-failure',
            message: 'Response body does not match the schema.',
            transaction: CHECKED,
          },
        ],
      }),
      CHECKED,
    );

    expect(detailed.reason).toBe('Response body does not match the schema.');
    expect(detailed.details).toEqual([]);
  });

  it('does not mistake its own status mismatch for a seed', () => {
    const result = checkedFromTestCase(
      testCase({
        status: 'skipped',
        actualStatus: 404,
        reason: 'Expected status code 200, but received 404.',
        results: [
          {
            type: 'invalid-transaction',
            message: 'Expected status code 200, but received 404.',
            transaction: CHECKED,
          },
        ],
      }),
      CHECKED,
    );

    expect(result.causedBy).toBeUndefined();
  });
});

describe('a transaction whose attempt threw', () => {
  it('is skipped when the request could not be built from the description', () => {
    const result = checkedFromError(
      new ThymianBaseError('Missing value for path parameter "id".', {
        name: 'RequestSerializationError',
        suggestions: ['Give it a value with an example …'],
      }),
      CHECKED,
    );

    expect(result).toEqual({
      selector: CHECKED_SELECTOR,
      outcome: 'skipped',
      expectedStatus: 200,
      reason: 'Missing value for path parameter "id".',
      details: ['Give it a value with an example …'],
    });
  });

  it('errored when anything else broke the attempt', () => {
    const result = checkedFromError(new Error('connect ECONNREFUSED'), CHECKED);

    expect(result.outcome).toBe('errored');
    expect(result.reason).toBe('connect ECONNREFUSED');
    expect(result.details).toEqual([]);
  });

  it('errored for a hook defect, with the hook named as raised', () => {
    const result = checkedFromError(
      new ThymianBaseError(
        'The beforeEach hook exported as "seed" from "seed.ts" threw.',
        { name: 'HookError', suggestions: ['Run with --debug …'] },
      ),
      CHECKED,
    );

    expect(result.outcome).toBe('errored');
    expect(result.details).toEqual(['Run with --debug …']);
  });
});

describe('the summary', () => {
  it('counts every outcome, and totals them', () => {
    const checked = [
      checkedFromTestCase(testCase({ actualStatus: 200 }), CHECKED),
      checkedFromTestCase(testCase({ status: 'failed' }), CHECKED),
      checkedFromTestCase(testCase({ status: 'skipped' }), CHECKED),
      checkedFromError(new Error('boom'), CHECKED),
    ];

    expect(summaryOf(checked)).toEqual({
      passed: 1,
      failed: 1,
      skipped: 1,
      errored: 1,
      total: 4,
    });
  });
});
