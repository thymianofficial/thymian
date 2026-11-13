import {
  httpRule,
  type RuleFnResult,
  statusCode,
  type ThymianHttpResponse,
} from '@thymian/core';
import {
  addTransaction,
  createBadRequestResponse,
  createCreatedResponse,
  createGetRequest,
  createOkResponse,
  createPostRequest,
  createRequiredParameter,
  createThymianFormat,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { runRule } from '../src/index.js';
import { createdResponsesHaveLocation } from './rules/created-responses-have-location.js';

const hasNoLocation = (res: ThymianHttpResponse) =>
  !Object.keys(res.headers).includes('location');

describe('runRule(rule).static(format)', () => {
  it('lists every transaction in the order it was added, whatever the rule says about it', async () => {
    const format = createThymianFormat();
    const astronautCreated = addTransaction(
      format,
      createPostRequest({ path: '/astronauts' }),
      createCreatedResponse(),
    );
    const launchesListed = addTransaction(
      format,
      createGetRequest({ path: '/launches' }),
      createOkResponse(),
    );
    const launchCreated = addTransaction(
      format,
      createPostRequest({ path: '/launches' }),
      createCreatedResponse({
        headers: { location: createRequiredParameter() },
      }),
    );

    const executions = await runRule(createdResponsesHaveLocation).static(
      format,
    );

    expect(executions.map(({ location }) => location)).toMatchObject([
      { elementId: astronautCreated },
      { elementId: launchesListed },
      { elementId: launchCreated },
    ]);
  });

  it('locates every transaction as the engine does, with a readable label', async () => {
    const format = createThymianFormat();
    const launchesListed = addTransaction(
      format,
      createGetRequest({ path: '/launches' }),
      createOkResponse(),
    );
    const astronautCreated = addTransaction(
      format,
      createPostRequest({ path: '/astronauts' }),
      createCreatedResponse(),
    );

    const executions = await runRule(createdResponsesHaveLocation).static(
      format,
    );

    expect(executions.map(({ location }) => location)).toEqual([
      {
        elementType: 'edge',
        elementId: launchesListed,
        label: expect.stringContaining('/launches'),
      },
      {
        elementType: 'edge',
        elementId: astronautCreated,
        pointer: '',
        label: expect.stringContaining('/astronauts'),
      },
    ]);
  });

  it('keeps a label the rule gave its location', async () => {
    const rule = httpRule('test/labels-its-location')
      .severity('error')
      .type('static')
      .rule((ctx) =>
        ctx.validateCommonHttpTransactions({
          appliesTo: statusCode(201),
          violatedWhen: (_req, _res, location) => [
            {
              location:
                typeof location === 'string'
                  ? location
                  : { ...location, label: 'the astronaut' },
              violation: {},
              findings: [],
            },
          ],
        }),
      )
      .done();
    const format = createThymianFormat();
    addTransaction(
      format,
      createPostRequest({ path: '/astronauts' }),
      createCreatedResponse(),
    );

    const executions = await runRule(rule).static(format);

    expect(executions).toMatchObject([
      { location: { label: 'the astronaut' }, status: 'failed' },
    ]);
  });

  it('gives a failed execution the message the rule built and the severity the rule declares', async () => {
    const rule = httpRule('test/builds-its-message')
      .severity('hint')
      .type('static')
      .rule((ctx) =>
        ctx.validateCommonHttpTransactions({
          appliesTo: statusCode(201),
          violatedWhen: (req, _res, location) => [
            {
              location,
              violation: { message: `${req.method} ${req.path} is flagged` },
              findings: [],
            },
          ],
        }),
      )
      .done();
    const format = createThymianFormat();
    addTransaction(
      format,
      createPostRequest({ path: '/astronauts' }),
      createCreatedResponse(),
    );

    const executions = await runRule(rule).static(format);

    expect(executions).toMatchObject([
      {
        status: 'failed',
        severity: 'hint',
        message: 'POST /astronauts is flagged',
      },
    ]);
  });

  it('gives passed and notApplicable executions neither message nor severity', async () => {
    const format = createThymianFormat();
    addTransaction(
      format,
      createGetRequest({ path: '/launches' }),
      createOkResponse(),
    );
    addTransaction(
      format,
      createPostRequest({ path: '/launches' }),
      createCreatedResponse({
        headers: { location: createRequiredParameter() },
      }),
    );

    const executions = await runRule(createdResponsesHaveLocation).static(
      format,
    );

    expect(executions.map((execution) => Object.keys(execution))).toEqual([
      ['location', 'status'],
      ['location', 'status'],
    ]);
  });

  it('lists a transaction once per execution the engine reports on it', async () => {
    const rule = httpRule('test/flags-twice')
      .severity('error')
      .type('static')
      .rule((ctx) =>
        ctx.validateCommonHttpTransactions({
          appliesTo: statusCode(201),
          violatedWhen: (_req, _res, location) => [
            { location, violation: { message: 'first' }, findings: [] },
            { location, violation: { message: 'second' }, findings: [] },
          ],
        }),
      )
      .done();
    const format = createThymianFormat();
    const launchesListed = addTransaction(
      format,
      createGetRequest({ path: '/launches' }),
      createOkResponse(),
    );
    const astronautCreated = addTransaction(
      format,
      createPostRequest({ path: '/astronauts' }),
      createCreatedResponse(),
    );

    const executions = await runRule(rule).static(format);

    expect(executions).toMatchObject([
      { location: { elementId: launchesListed }, status: 'notApplicable' },
      {
        location: { elementId: astronautCreated },
        status: 'failed',
        message: 'first',
      },
      {
        location: { elementId: astronautCreated },
        status: 'failed',
        message: 'second',
      },
    ]);
    expect(executions).toHaveLength(3);
  });

  it('reports a transaction the rule skipped as skipped, with the reason', async () => {
    const rule = httpRule('test/skips')
      .severity('error')
      .type('static')
      .rule((ctx) =>
        ctx.validateCommonHttpTransactions({
          appliesTo: statusCode(201),
          violatedWhen: (_req, _res, location) => [
            {
              location,
              findings: [
                {
                  kind: 'rule-skip',
                  title: 'skipped',
                  reason: 'cannot decide from a specification',
                },
              ],
            },
          ],
        }),
      )
      .done();
    const format = createThymianFormat();
    addTransaction(
      format,
      createPostRequest({ path: '/astronauts' }),
      createCreatedResponse(),
    );

    const executions = await runRule(rule).static(format);

    expect(executions).toMatchObject([
      { status: 'skipped', reason: 'cannot decide from a specification' },
    ]);
  });

  it('counts a transaction as applicable when any of the stated applicabilities accepts it', async () => {
    const rule = httpRule('test/states-two-applicabilities')
      .severity('error')
      .type('static')
      .rule(async (ctx) => [
        ...(await ctx.validateCommonHttpTransactions({
          appliesTo: statusCode(201),
          violatedWhen: () => [],
        })),
        ...(await ctx.validateCommonHttpTransactions({
          appliesTo: statusCode(400),
          violatedWhen: () => [],
        })),
      ])
      .done();
    const format = createThymianFormat();
    const createAstronaut = createPostRequest({ path: '/astronauts' });
    addTransaction(format, createGetRequest(), createOkResponse());
    addTransaction(format, createAstronaut, createCreatedResponse());
    addTransaction(format, createAstronaut, createBadRequestResponse());

    const executions = await runRule(rule).static(format);

    expect(executions.map(({ status }) => status)).toEqual([
      'notApplicable',
      'passed',
      'passed',
    ]);
  });

  it('reads the applicability of a positional rule-context call too', async () => {
    const rule = httpRule('test/states-positionally')
      .severity('error')
      .type('static')
      .rule((ctx) =>
        ctx.validateCommonHttpTransactions(statusCode(201), () => []),
      )
      .done();
    const format = createThymianFormat();
    addTransaction(format, createGetRequest(), createOkResponse());
    addTransaction(format, createPostRequest(), createCreatedResponse());

    const executions = await runRule(rule).static(format);

    expect(executions.map(({ status }) => status)).toEqual([
      'notApplicable',
      'passed',
    ]);
  });

  it('reports every unflagged transaction as passed when a call gives only a violation condition', async () => {
    const rule = httpRule('test/states-only-a-condition')
      .severity('error')
      .type('static')
      .rule((ctx) => ctx.validateCommonHttpTransactions(statusCode(201)))
      .done();
    const format = createThymianFormat();
    addTransaction(format, createGetRequest(), createOkResponse());
    addTransaction(format, createPostRequest(), createCreatedResponse());

    const executions = await runRule(rule).static(format);

    expect(executions.map(({ status }) => status)).toEqual([
      'passed',
      'failed',
    ]);
  });

  describe('a rule that decides applicability in a plain callback', () => {
    const rule = httpRule('test/decides-in-a-callback')
      .severity('error')
      .type('static')
      .summary('A 201 response needs a Location header')
      .rule((ctx) =>
        ctx.validateHttpTransactions({
          appliesTo: (_req, res) => res.statusCode === 201,
          violatedWhen: (_req, res) => hasNoLocation(res),
        }),
      )
      .done();

    it('reports every unflagged transaction as passed', async () => {
      const format = createThymianFormat();
      const launchesListed = addTransaction(
        format,
        createGetRequest({ path: '/launches' }),
        createOkResponse(),
      );
      const launchCreated = addTransaction(
        format,
        createPostRequest({ path: '/launches' }),
        createCreatedResponse({
          headers: { location: createRequiredParameter() },
        }),
      );
      const astronautCreated = addTransaction(
        format,
        createPostRequest({ path: '/astronauts' }),
        createCreatedResponse(),
      );

      const executions = await runRule(rule).static(format);

      expect(executions).toMatchObject([
        { location: { elementId: launchesListed }, status: 'passed' },
        { location: { elementId: launchCreated }, status: 'passed' },
        {
          location: { elementId: astronautCreated },
          status: 'failed',
          message: 'A 201 response needs a Location header',
        },
      ]);
      expect(executions).toHaveLength(3);
    });

    it('does so too when the rule states an applicability elsewhere', async () => {
      const mixed = httpRule('test/states-one-and-decides-one')
        .severity('error')
        .type('static')
        .rule(async (ctx) => [
          ...(await ctx.validateCommonHttpTransactions({
            appliesTo: statusCode(201),
            violatedWhen: () => [],
          })),
          ...(await ctx.validateHttpTransactions({
            appliesTo: () => true,
            violatedWhen: () => false,
          })),
        ])
        .done();
      const format = createThymianFormat();
      addTransaction(format, createGetRequest(), createOkResponse());

      const executions = await runRule(mixed).static(format);

      expect(executions).toMatchObject([{ status: 'passed' }]);
    });
  });

  describe('a result the engine locates somewhere else than on a transaction', () => {
    const format = createThymianFormat();
    const [launchesRequest, , launchesListed] = format.addHttpTransaction(
      createGetRequest({ path: '/launches' }),
      createOkResponse(),
      'test-source',
    );
    const astronautCreated = addTransaction(
      format,
      createPostRequest({ path: '/astronauts' }),
      createCreatedResponse(),
    );

    const flagsElsewhere = (results: RuleFnResult[]) =>
      httpRule('test/flags-elsewhere')
        .severity('error')
        .type('static')
        .summary('flagged elsewhere')
        .rule(async (ctx) => [
          ...results,
          ...(await ctx.validateCommonHttpTransactions({
            appliesTo: statusCode(201),
            violatedWhen: (_req, _res, location) => [
              { location, violation: {}, findings: [] },
            ],
          })),
        ])
        .done();

    it('returns a request node as reported, after the transactions', async () => {
      const rule = flagsElsewhere([
        {
          location: { elementType: 'node', elementId: launchesRequest },
          violation: {},
          findings: [],
        },
      ]);

      const executions = await runRule(rule).static(format);

      expect(executions).toMatchObject([
        { location: { elementId: launchesListed }, status: 'notApplicable' },
        { location: { elementId: astronautCreated }, status: 'failed' },
        {
          location: { elementType: 'node', elementId: launchesRequest },
          status: 'failed',
          severity: 'error',
          message: 'flagged elsewhere',
        },
      ]);
      expect(executions).toHaveLength(3);
    });

    it('returns a free string as reported, after the transactions', async () => {
      const rule = flagsElsewhere([
        { location: 'the whole API', violation: {}, findings: [] },
      ]);

      const executions = await runRule(rule).static(format);

      expect(executions).toMatchObject([
        { location: { elementId: launchesListed }, status: 'notApplicable' },
        { location: { elementId: astronautCreated }, status: 'failed' },
        { location: 'the whole API', status: 'failed' },
      ]);
      expect(executions).toHaveLength(3);
    });
  });

  it('throws for a rule that does not declare static, naming the rule and its declared contexts', async () => {
    const rule = httpRule('test/live-only')
      .severity('error')
      .type('test', 'analytics')
      .rule((ctx) =>
        ctx.validateCommonHttpTransactions({
          appliesTo: statusCode(201),
          violatedWhen: () => [],
        }),
      )
      .done();

    await expect(runRule(rule).static(createThymianFormat())).rejects.toThrow(
      'Rule "test/live-only" does not declare the "static" context. It declares: test, analytics.',
    );
  });
});
