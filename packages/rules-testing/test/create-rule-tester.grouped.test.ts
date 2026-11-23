import {
  type GroupedCommonHttpViolationConditionFn,
  httpRule,
  type RuleFnResult,
  statusCode,
  url,
} from '@thymian/core';
import {
  addTransaction,
  createCreatedResponse,
  createGetRequest,
  createOkResponse,
  createPostRequest,
  createPutRequest,
  createRequiredParameter,
  createThymianFormat,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { createRuleTester, recorded } from '../src/index.js';

const message = 'A resource sends ETag on every 200 answer or on none';

/**
 * Compares the 200 answers of one resource with each other and hands the
 * answers without an ETag to `blame`, when another answer has one.
 */
function sendsEtagOnEveryAnswerOrNone(
  blame: (
    key: string,
    withoutEtag: Parameters<GroupedCommonHttpViolationConditionFn>[1],
  ) => RuleFnResult[],
) {
  return {
    appliesTo: statusCode(200),
    groupBy: url(),
    violatedWhen: ((key, answers) => {
      const withoutEtag = answers.filter(
        ([, response]) => !response.headers.includes('etag'),
      );

      return withoutEtag.length === 0 || withoutEtag.length === answers.length
        ? []
        : blame(key, withoutEtag);
    }) satisfies GroupedCommonHttpViolationConditionFn,
  };
}

/** Finds the answer without an ETag at fault. */
const answersCarryTheEtagOfTheirResource = httpRule(
  'test/answers-carry-the-etag-of-their-resource',
)
  .severity('error')
  .type('static', 'test', 'analytics')
  .summary(message)
  .rule((ctx) =>
    ctx.validateGroupedCommonHttpTransactions(
      sendsEtagOnEveryAnswerOrNone((_key, withoutEtag) =>
        withoutEtag.map(([, , location]) => ({
          location,
          violation: {},
          findings: [],
        })),
      ),
    ),
  )
  .done();

/** Finds the resource at fault, which is the group. */
const resourcesSendEtagConsistently = httpRule(
  'test/resources-send-etag-consistently',
)
  .severity('error')
  .type('static', 'test', 'analytics')
  .summary(message)
  .rule((ctx) =>
    ctx.validateGroupedCommonHttpTransactions(
      sendsEtagOnEveryAnswerOrNone((key) => [
        { location: key, violation: {}, findings: [] },
      ]),
    ),
  )
  .done();

function spaceAgency() {
  const format = createThymianFormat();

  return {
    format,
    launchRead: addTransaction(
      format,
      createGetRequest({ path: '/launches' }),
      createOkResponse({ headers: { etag: createRequiredParameter() } }),
    ),
    launchReplaced: addTransaction(
      format,
      createPutRequest({ path: '/launches' }),
      createOkResponse(),
    ),
    launchCreated: addTransaction(
      format,
      createPostRequest({ path: '/launches' }),
      createCreatedResponse(),
    ),
    astronautRead: addTransaction(
      format,
      createGetRequest({ path: '/astronauts' }),
      createOkResponse(),
    ),
    astronautReplaced: addTransaction(
      format,
      createPutRequest({ path: '/astronauts' }),
      createOkResponse(),
    ),
  };
}

describe('createRuleTester(rule) with a grouped rule', () => {
  it('shows the member a rule blames as failed and its siblings as passed, in every context', async () => {
    const api = spaceAgency();
    const ruleTester = createRuleTester(answersCarryTheEtagOfTheirResource);

    const expected = [
      { location: { elementId: api.launchRead }, status: 'passed' },
      {
        location: { elementId: api.launchReplaced },
        status: 'failed',
        severity: 'error',
        message,
      },
      { location: { elementId: api.launchCreated }, status: 'notApplicable' },
      { location: { elementId: api.astronautRead }, status: 'passed' },
      { location: { elementId: api.astronautReplaced }, status: 'passed' },
    ];

    const results = {
      static: await ruleTester.runLint(api.format),
      test: await ruleTester.runTest(api.format),
      analytics: await ruleTester.runAnalyze(api.format),
    };

    expect(results).toMatchObject({
      static: expected,
      test: expected,
      analytics: expected,
    });
    for (const executions of Object.values(results)) {
      expect(executions).toHaveLength(expected.length);
      expect(executions.filter(({ group }) => group !== undefined)).toEqual([]);
    }
  });

  it('shows every member of a group a rule blames as failed, with the group key, in every context', async () => {
    const api = spaceAgency();
    const ruleTester = createRuleTester(resourcesSendEtagConsistently);

    const failed = {
      status: 'failed',
      severity: 'error',
      message,
      group: expect.stringContaining('/launches'),
    };
    const expected = [
      { location: { elementId: api.launchRead }, ...failed },
      { location: { elementId: api.launchReplaced }, ...failed },
      { location: { elementId: api.launchCreated }, status: 'notApplicable' },
      { location: { elementId: api.astronautRead }, status: 'passed' },
      { location: { elementId: api.astronautReplaced }, status: 'passed' },
    ];

    const results = {
      static: await ruleTester.runLint(api.format),
      test: await ruleTester.runTest(api.format),
      analytics: await ruleTester.runAnalyze(api.format),
    };

    expect(results).toMatchObject({
      static: expected,
      test: expected,
      analytics: expected,
    });
    for (const executions of Object.values(results)) {
      expect(executions).toHaveLength(expected.length);
      // The members of one group carry one key.
      expect(executions[0]?.group).toBe(executions[1]?.group);
    }
  });

  it('labels the members of a blamed group as it labels any transaction', async () => {
    const api = spaceAgency();

    const [launchRead] = await createRuleTester(
      resourcesSendEtagConsistently,
    ).runLint(api.format);

    expect(launchRead?.location).toEqual({
      elementType: 'edge',
      elementId: api.launchRead,
      label: expect.stringContaining('/launches'),
    });
  });

  it("skips every member of a group in test when no member's live status is inside the rule's applicability", async () => {
    const api = spaceAgency();

    const executions = await createRuleTester(
      resourcesSendEtagConsistently,
    ).runTest(api.format, {
      respond: ({ transaction, conforming }) =>
        transaction === api.launchRead || transaction === api.launchReplaced
          ? { ...conforming, statusCode: 500 }
          : conforming,
    });

    const skipped = {
      status: 'skipped',
      reason: expect.stringContaining(
        'the specification declares 200, the server answered 500',
      ),
      group: expect.stringContaining('/launches'),
    };
    expect(executions).toMatchObject([
      { location: { elementId: api.launchRead }, ...skipped },
      { location: { elementId: api.launchReplaced }, ...skipped },
      { location: { elementId: api.launchCreated }, status: 'notApplicable' },
      { location: { elementId: api.astronautRead }, status: 'passed' },
      { location: { elementId: api.astronautReplaced }, status: 'passed' },
    ]);
    expect(executions).toHaveLength(5);
  });

  it("judges the members of a group in test whose live status is inside the rule's applicability", async () => {
    const api = spaceAgency();

    const executions = await createRuleTester(
      resourcesSendEtagConsistently,
    ).runTest(api.format, {
      respond: ({ transaction, conforming }) =>
        transaction === api.launchReplaced
          ? { ...conforming, statusCode: 500 }
          : conforming,
    });

    expect(executions).toMatchObject([
      { location: { elementId: api.launchRead }, status: 'passed' },
      // Not judged: the live re-check rejects it, and the tester lists a
      // member the rule said nothing about with the status of its group.
      { location: { elementId: api.launchReplaced }, status: 'passed' },
      { location: { elementId: api.launchCreated }, status: 'notApplicable' },
      { location: { elementId: api.astronautRead }, status: 'passed' },
      { location: { elementId: api.astronautReplaced }, status: 'passed' },
    ]);
    expect(executions).toHaveLength(5);
  });

  it('lists a blamed group once per recording in analytics, although two recordings are of one transaction', async () => {
    const api = spaceAgency();

    const executions = await createRuleTester(
      resourcesSendEtagConsistently,
    ).runAnalyze(api.format, {
      traffic: [
        recorded(api.format, api.launchRead),
        recorded(api.format, api.launchReplaced),
        recorded(api.format, api.launchReplaced),
      ],
    });

    expect(executions).toMatchObject([
      { location: { elementId: api.launchRead }, status: 'failed' },
      { location: { elementId: api.launchReplaced }, status: 'failed' },
      { location: { elementId: api.launchReplaced }, status: 'failed' },
      { location: { elementId: api.launchCreated }, status: 'notApplicable' },
      { location: { elementId: api.astronautRead }, status: 'notApplicable' },
      {
        location: { elementId: api.astronautReplaced },
        status: 'notApplicable',
      },
    ]);
    expect(executions).toHaveLength(6);
  });
});
