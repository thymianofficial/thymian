import { readFile } from 'node:fs/promises';
import { Socket } from 'node:net';

import {
  type HttpRequest,
  type HttpResponse,
  httpRule,
  not,
  responseHeader,
  statusCode,
} from '@thymian/core';
import {
  addTransaction,
  createBadRequestResponse,
  createCreatedResponse,
  createGetRequest,
  createObjectSchema,
  createOkResponse,
  createOptionalParameter,
  createPostRequest,
  createRequiredParameter,
  createStringSchema,
  createThymianFormat,
} from '@thymian/core-testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runRule } from '../src/index.js';
import { createdResponsesHaveLocation } from './rules/created-responses-have-location.js';

vi.mock('node:fs/promises', { spy: true });

/** Runs a rule that flags nothing and returns the pairs the analyzer read. */
async function recordedPairsOf(
  format: ReturnType<typeof createThymianFormat>,
): Promise<{ request: HttpRequest; response: HttpResponse }[]> {
  const pairs: { request: HttpRequest; response: HttpResponse }[] = [];
  const readsEverything = httpRule('test/reads-every-recorded-pair')
    .severity('error')
    .type('analytics')
    .rule((ctx) =>
      // No recording has status 0, so this reads every pair.
      ctx.validateCapturedHttpTransactions(not(statusCode(0)), (pair) => {
        pairs.push({
          request: pair.request.data,
          response: pair.response.data,
        });
        return [];
      }),
    )
    .done();

  await runRule(readsEverything).analytics(format);

  return pairs;
}

describe('runRule(rule).analytics(format)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('lists every transaction in the order it was added, located as in static', async () => {
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
    const run = runRule(createdResponsesHaveLocation);

    const executions = await run.analytics(format);

    expect(executions.map(({ location }) => location)).toMatchObject([
      {
        elementType: 'edge',
        elementId: astronautCreated,
        label: expect.stringContaining('/astronauts'),
      },
      {
        elementType: 'edge',
        elementId: launchesListed,
        label: expect.stringContaining('/launches'),
      },
      {
        elementType: 'edge',
        elementId: launchCreated,
        label: expect.stringContaining('/launches'),
      },
    ]);
    expect(executions.map(({ status }) => status)).toEqual(
      (await run.static(format)).map(({ status }) => status),
    );
    expect(executions.every(({ findings }) => Array.isArray(findings))).toBe(
      true,
    );
  });

  it('gives a failed execution the message the rule built and the severity the rule declares, on the transaction', async () => {
    const rule = httpRule('test/builds-its-message')
      .severity('hint')
      .type('analytics')
      .rule((ctx) =>
        ctx.validateCommonHttpTransactions({
          appliesTo: statusCode(201),
          violatedWhen: (_req, res, location) => [
            {
              location,
              violation: { message: `${res.statusCode} without a Location` },
              findings: [],
            },
          ],
        }),
      )
      .done();
    const format = createThymianFormat();
    const astronautCreated = addTransaction(
      format,
      createPostRequest({ path: '/astronauts' }),
      createCreatedResponse(),
    );

    const executions = await runRule(rule).analytics(format);

    expect(executions).toMatchObject([
      {
        location: { elementType: 'edge', elementId: astronautCreated },
        status: 'failed',
        severity: 'hint',
        message: '201 without a Location',
      },
    ]);
    expect(executions).toHaveLength(1);
  });

  it('throws when the rule does not declare analytics', async () => {
    const rule = httpRule('test/static-only')
      .severity('error')
      .type('static')
      .rule(() => [])
      .done();

    await expect(
      runRule(rule).analytics(createThymianFormat()),
    ).rejects.toThrow(
      'Rule "test/static-only" does not declare the "analytics" context. It declares: static.',
    );
  });

  it('reads no traffic from disk and sends nothing over the network', async () => {
    const fetched = vi.spyOn(globalThis, 'fetch');
    const connected = vi.spyOn(Socket.prototype, 'connect');
    const format = createThymianFormat();
    addTransaction(
      format,
      createPostRequest({ path: '/astronauts' }),
      createCreatedResponse(),
    );

    await runRule(createdResponsesHaveLocation).analytics(format);

    // The one file the analyzer reads is its own table definitions.
    expect(
      vi.mocked(readFile).mock.calls.map(([path]) => String(path)),
    ).toEqual([expect.stringMatching(/init\.sql$/)]);
    expect(fetched).not.toHaveBeenCalled();
    expect(connected).not.toHaveBeenCalled();
  });

  describe('the traffic', () => {
    it('is every transaction recorded once, answered as the format declares', async () => {
      const format = createThymianFormat();
      addTransaction(
        format,
        createGetRequest({
          path: '/launches/{id}',
          pathParameters: {
            id: createRequiredParameter({
              schema: createStringSchema({ examples: ['apollo-11'] }),
            }),
          },
        }),
        createOkResponse({
          mediaType: 'application/json',
          headers: { etag: createOptionalParameter() },
          schema: createObjectSchema({}, { examples: [{ name: 'Apollo 11' }] }),
        }),
      );
      addTransaction(
        format,
        createPostRequest({ path: '/astronauts' }),
        createCreatedResponse({
          headers: {
            location: createRequiredParameter({
              schema: createStringSchema({ examples: ['/astronauts/7'] }),
            }),
          },
        }),
      );

      const pairs = await recordedPairsOf(format);

      expect(pairs).toMatchObject([
        {
          request: { method: 'GET', path: '/launches/apollo-11' },
          response: {
            statusCode: 200,
            headers: {
              etag: expect.any(String),
              'content-type': 'application/json',
            },
            body: '{"name":"Apollo 11"}',
          },
        },
        {
          request: { method: 'POST', path: '/astronauts' },
          response: {
            statusCode: 201,
            headers: { location: '/astronauts/7' },
          },
        },
      ]);
      expect(pairs).toHaveLength(2);
    });

    it('records a request that matches its transaction when the format declares a request body', async () => {
      const format = createThymianFormat();
      const astronautCreated = addTransaction(
        format,
        createPostRequest({
          path: '/astronauts',
          mediaType: 'application/json',
          body: createObjectSchema({}, { examples: [{ name: 'Sally Ride' }] }),
        }),
        createCreatedResponse(),
      );

      const [pair] = await recordedPairsOf(format);
      const executions = await runRule(createdResponsesHaveLocation).analytics(
        format,
      );

      expect(pair?.request).toMatchObject({
        headers: { 'content-type': 'application/json' },
        body: '{"name":"Sally Ride"}',
      });
      expect(executions).toMatchObject([
        { location: { elementId: astronautCreated }, status: 'failed' },
      ]);
      expect(executions).toHaveLength(1);
    });

    it('is seen by a rule that speaks about one participant', async () => {
      const rule = httpRule('test/speaks-about-servers')
        .severity('error')
        .type('analytics')
        .appliesTo('server')
        .rule((ctx) =>
          ctx.validateCommonHttpTransactions({
            appliesTo: statusCode(201),
            violatedWhen: not(responseHeader('location')),
          }),
        )
        .done();
      const format = createThymianFormat();
      const astronautCreated = addTransaction(
        format,
        createPostRequest({ path: '/astronauts' }),
        createCreatedResponse(),
      );

      expect(await runRule(rule).analytics(format)).toMatchObject([
        { location: { elementId: astronautCreated }, status: 'failed' },
      ]);
    });

    it('leaves transactions the format cannot tell apart in a recording without one: the execution keeps its label', async () => {
      const format = createThymianFormat();
      const createAstronaut = createPostRequest({ path: '/astronauts' });
      const createdBare = addTransaction(
        format,
        createAstronaut,
        createCreatedResponse(),
      );
      const createdWithLocation = addTransaction(
        format,
        createAstronaut,
        createCreatedResponse({
          headers: { location: createRequiredParameter() },
        }),
      );

      const executions = await runRule(createdResponsesHaveLocation).analytics(
        format,
      );

      expect(executions).toMatchObject([
        { location: { elementId: createdBare }, status: 'notApplicable' },
        {
          location: { elementId: createdWithLocation },
          status: 'notApplicable',
        },
        { location: expect.stringContaining('/astronauts'), status: 'failed' },
      ]);
      expect(executions).toHaveLength(3);
    });

    it('cannot be recorded for a request that cannot be built, and says which', async () => {
      const format = createThymianFormat();
      addTransaction(
        format,
        createGetRequest({
          path: '/launches/{id}',
          pathParameters: { id: createRequiredParameter() },
        }),
        createOkResponse(),
      );

      await expect(
        runRule(createdResponsesHaveLocation).analytics(format),
      ).rejects.toThrow(
        /^Cannot record ".*\/launches\/\{id\}.*": Missing value for path parameter "id"\./,
      );
    });
  });

  describe('passed and notApplicable', () => {
    it('come from the applicability a rule states to validateHttpTransactions, which is an expression in analytics', async () => {
      const rule = httpRule('test/uncommon-form')
        .severity('error')
        .type('analytics')
        .rule((ctx) =>
          ctx.validateHttpTransactions({
            appliesTo: statusCode(201),
            violatedWhen: not(responseHeader('location')),
          }),
        )
        .done();
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
      const createAstronaut = createPostRequest({ path: '/astronauts' });
      const astronautCreated = addTransaction(
        format,
        createAstronaut,
        createCreatedResponse(),
      );
      const astronautRejected = addTransaction(
        format,
        createAstronaut,
        createBadRequestResponse(),
      );

      const executions = await runRule(rule).analytics(format);

      expect(executions).toMatchObject([
        { location: { elementId: launchesListed }, status: 'notApplicable' },
        { location: { elementId: launchCreated }, status: 'passed' },
        { location: { elementId: astronautCreated }, status: 'failed' },
        { location: { elementId: astronautRejected }, status: 'notApplicable' },
      ]);
      expect(executions).toHaveLength(4);
    });

    it('are asked of the recorded pair: an optional header the format declares is in the recording', async () => {
      const rule = httpRule('test/speaks-about-tagged-responses')
        .severity('error')
        .type('analytics')
        .rule((ctx) =>
          ctx.validateCommonHttpTransactions({
            appliesTo: responseHeader('etag'),
            violatedWhen: () => [],
          }),
        )
        .done();
      const format = createThymianFormat();
      const launchesListed = addTransaction(
        format,
        createGetRequest({ path: '/launches' }),
        createOkResponse({ headers: { etag: createOptionalParameter() } }),
      );
      const astronautsListed = addTransaction(
        format,
        createGetRequest({ path: '/astronauts' }),
        createOkResponse(),
      );

      expect(await runRule(rule).analytics(format)).toMatchObject([
        { location: { elementId: launchesListed }, status: 'passed' },
        { location: { elementId: astronautsListed }, status: 'notApplicable' },
      ]);
    });

    it('are passed for every unflagged transaction when the rule reads whole traces, which state no applicability', async () => {
      const rule = httpRule('test/reads-traces')
        .severity('error')
        .type('analytics')
        .rule((ctx) => ctx.validateCapturedHttpTraces(() => []))
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

      expect(await runRule(rule).analytics(format)).toMatchObject([
        { location: { elementId: launchesListed }, status: 'passed' },
        { location: { elementId: astronautCreated }, status: 'passed' },
      ]);
    });
  });

  it('returns an execution the rule locates on a free string as reported, after the transactions', async () => {
    const rule = httpRule('test/flags-the-recording')
      .severity('error')
      .type('analytics')
      .summary('flagged by its label')
      .rule((ctx) =>
        ctx.validateCapturedHttpTransactions(
          statusCode(201),
          (_pair, label) => [{ location: label, violation: {}, findings: [] }],
        ),
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

    const executions = await runRule(rule).analytics(format);

    expect(executions).toMatchObject([
      { location: { elementId: launchesListed }, status: 'notApplicable' },
      { location: { elementId: astronautCreated }, status: 'passed' },
      {
        location: expect.stringContaining('/astronauts'),
        status: 'failed',
        message: 'flagged by its label',
      },
    ]);
    expect(executions).toHaveLength(3);
  });

  it('runs a rule that ships with severity off, with the options it is given', async () => {
    const rule = httpRule('test/created-responses-have-header')
      .severity('off')
      .type('analytics')
      .options<{ header: string }>({
        type: 'object',
        properties: { header: { type: 'string' } },
        required: ['header'],
      })
      .rule((ctx, options) =>
        ctx.validateCommonHttpTransactions({
          appliesTo: statusCode(201),
          violatedWhen: not(responseHeader(options.header)),
        }),
      )
      .done();
    const format = createThymianFormat();
    const launchCreated = addTransaction(
      format,
      createPostRequest({ path: '/launches' }),
      createCreatedResponse({
        headers: { location: createRequiredParameter() },
      }),
    );

    expect(
      await runRule(rule, { options: { header: 'location' } }).analytics(
        format,
      ),
    ).toMatchObject([
      { location: { elementId: launchCreated }, status: 'passed' },
    ]);
    expect(
      await runRule(rule, { options: { header: 'etag' } }).analytics(format),
    ).toMatchObject([
      {
        location: { elementId: launchCreated },
        status: 'failed',
        severity: 'off',
      },
    ]);
  });
});
