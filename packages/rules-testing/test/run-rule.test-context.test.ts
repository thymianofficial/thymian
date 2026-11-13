import { Socket } from 'node:net';

import {
  type HttpRequest,
  type HttpResponse,
  httpRule,
  statusCode,
  statusCodeRange,
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

import { type RespondTo, runRule } from '../src/index.js';
import { clientErrorsAreProblemJson } from './rules/client-errors-are-problem-json.js';
import { createdResponsesHaveLocation } from './rules/created-responses-have-location.js';

/** Runs a rule that flags nothing and returns what the responder was given. */
async function exchangesOf(
  format: ReturnType<typeof createThymianFormat>,
): Promise<RespondTo[]> {
  const exchanges: RespondTo[] = [];
  const asksEverything = httpRule('test/asks-every-transaction')
    .severity('error')
    .type('test')
    .rule((ctx) =>
      ctx.validateCommonHttpTransactions({
        appliesTo: statusCodeRange(200, 499),
        violatedWhen: () => [],
      }),
    )
    .done();

  await runRule(asksEverything).test(format, {
    respond: (exchange) => {
      exchanges.push(exchange);
      return exchange.conforming;
    },
  });

  return exchanges;
}

describe('runRule(rule).test(format)', () => {
  afterEach(() => {
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

    const executions = await run.test(format);

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

  it('throws when the rule does not declare test', async () => {
    const rule = httpRule('test/static-only')
      .severity('error')
      .type('static')
      .rule(() => [])
      .done();

    await expect(runRule(rule).test(createThymianFormat())).rejects.toThrow(
      'Rule "test/static-only" does not declare the "test" context. It declares: static.',
    );
  });

  it('opens no port and sends nothing over the network', async () => {
    const fetched = vi.spyOn(globalThis, 'fetch');
    const format = createThymianFormat();
    addTransaction(
      format,
      createPostRequest({ path: '/astronauts' }),
      createCreatedResponse(),
    );

    const connected = vi.spyOn(Socket.prototype, 'connect');

    await runRule(createdResponsesHaveLocation).test(format);

    expect(fetched).not.toHaveBeenCalled();
    expect(connected).not.toHaveBeenCalled();
  });

  describe('the conforming response', () => {
    it('carries the declared status, every declared header, the media type and a declared body', async () => {
      const format = createThymianFormat();
      addTransaction(
        format,
        createPostRequest({ path: '/astronauts' }),
        createCreatedResponse({
          mediaType: 'application/json',
          headers: {
            location: createRequiredParameter({
              schema: createStringSchema({ examples: ['/astronauts/7'] }),
            }),
            etag: createOptionalParameter(),
          },
          schema: createObjectSchema(
            {},
            { examples: [{ name: 'Sally Ride' }] },
          ),
        }),
      );

      const [exchange] = await exchangesOf(format);

      expect(exchange?.conforming).toMatchObject({
        statusCode: 201,
        headers: {
          location: '/astronauts/7',
          etag: expect.any(String),
          'content-type': 'application/json',
        },
        body: '{"name":"Sally Ride"}',
      });
    });

    it('has no body and no content type when the format declares neither', async () => {
      const format = createThymianFormat();
      addTransaction(
        format,
        createGetRequest({ path: '/launches' }),
        createOkResponse({ mediaType: '' }),
      );

      const [exchange] = await exchangesOf(format);

      expect(exchange?.conforming.headers).toEqual({});
      expect(exchange?.conforming).not.toHaveProperty('body');
    });
  });

  describe('respond', () => {
    it('gets each answer of one operation for the request aimed at it', async () => {
      const format = createThymianFormat();
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

      const exchanges = await exchangesOf(format);

      expect(
        exchanges.map(({ transaction, conforming }) => [
          transaction,
          conforming.statusCode,
        ]),
      ).toEqual(
        expect.arrayContaining([
          [astronautCreated, 201],
          [astronautRejected, 400],
        ]),
      );
      expect(exchanges).toHaveLength(2);
    });

    it('receives the request that was sent', async () => {
      const format = createThymianFormat();
      addTransaction(
        format,
        createPostRequest({
          path: '/crews/{crew}/astronauts',
          pathParameters: {
            crew: createRequiredParameter({
              schema: createStringSchema({ examples: ['sts-7'] }),
            }),
          },
        }),
        createCreatedResponse(),
      );

      const [exchange] = await exchangesOf(format);

      expect(exchange?.request).toMatchObject({
        method: 'POST',
        origin: 'https://localhost:443',
        path: '/crews/sts-7/astronauts',
      } satisfies Partial<HttpRequest>);
    });

    it('fails the transaction whose declared header the server drops', async () => {
      const format = createThymianFormat();
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
        createCreatedResponse({
          headers: { location: createRequiredParameter() },
        }),
      );

      const executions = await runRule(createdResponsesHaveLocation).test(
        format,
        {
          respond: ({ transaction, conforming }) =>
            transaction === launchCreated
              ? { ...conforming, headers: {} }
              : conforming,
        },
      );

      expect(executions).toMatchObject([
        {
          location: { elementId: launchCreated },
          status: 'failed',
          severity: 'warn',
          message:
            'A 201 Created response must name the new resource in a Location header',
        },
        { location: { elementId: astronautCreated }, status: 'passed' },
      ]);
      expect(executions).toHaveLength(2);
    });

    it('skips the transaction the server answers with another status, with a reason', async () => {
      const format = createThymianFormat();
      const launchCreated = addTransaction(
        format,
        createPostRequest({ path: '/launches' }),
        createCreatedResponse(),
      );
      const astronautCreated = addTransaction(
        format,
        createPostRequest({ path: '/astronauts' }),
        createCreatedResponse(),
      );

      const executions = await runRule(createdResponsesHaveLocation).test(
        format,
        {
          respond: ({ transaction, conforming }) =>
            transaction === launchCreated
              ? { ...conforming, statusCode: 500 }
              : conforming,
        },
      );

      expect(executions).toMatchObject([
        {
          location: { elementId: launchCreated },
          status: 'skipped',
          reason: expect.stringContaining(
            'Expected status code 201, but received 500',
          ),
        },
        { location: { elementId: astronautCreated }, status: 'failed' },
      ]);
      expect(executions).toHaveLength(2);
    });

    it('changes many answers with one condition', async () => {
      const format = createThymianFormat();
      const launchMissing = addTransaction(
        format,
        createGetRequest({ path: '/launches/apollo-11' }),
        createBadRequestResponse({ mediaType: 'application/problem+json' }),
      );
      const astronautRejected = addTransaction(
        format,
        createPostRequest({ path: '/astronauts' }),
        createBadRequestResponse({ mediaType: 'application/problem+json' }),
      );

      const executions = await runRule(clientErrorsAreProblemJson).test(
        format,
        {
          respond: ({ conforming }): HttpResponse =>
            conforming.statusCode >= 400
              ? {
                  ...conforming,
                  headers: {
                    ...conforming.headers,
                    'content-type': 'text/html',
                  },
                }
              : conforming,
        },
      );

      expect(executions).toMatchObject([
        { location: { elementId: launchMissing }, status: 'failed' },
        { location: { elementId: astronautRejected }, status: 'failed' },
      ]);
    });

    it('may answer asynchronously', async () => {
      const format = createThymianFormat();
      const launchCreated = addTransaction(
        format,
        createPostRequest({ path: '/launches' }),
        createCreatedResponse(),
      );

      const executions = await runRule(createdResponsesHaveLocation).test(
        format,
        {
          respond: async ({ conforming }) => ({
            ...conforming,
            headers: { location: '/launches/1' },
          }),
        },
      );

      expect(executions).toMatchObject([
        { location: { elementId: launchCreated }, status: 'passed' },
      ]);
    });
  });

  describe('what the tester reports', () => {
    it('skips a transaction whose request cannot be built, with the reason', async () => {
      const format = createThymianFormat();
      const launchFound = addTransaction(
        format,
        createGetRequest({ path: '/launches/{id}' }),
        createOkResponse(),
      );
      const rule = httpRule('test/ok-is-fine')
        .severity('error')
        .type('test')
        .rule((ctx) =>
          ctx.validateCommonHttpTransactions({
            appliesTo: statusCode(200),
            violatedWhen: () => [],
          }),
        )
        .done();

      const executions = await runRule(rule).test(format);

      expect(executions).toMatchObject([
        {
          location: { elementId: launchFound },
          status: 'skipped',
          reason: 'Missing value for path parameter "id".',
        },
      ]);
    });

    it('carries the message and findings of a rule that builds them itself', async () => {
      const rule = httpRule('test/notes-what-it-saw')
        .severity('off')
        .type('test')
        .options<{ header: string }>({
          type: 'object',
          properties: { header: { type: 'string' } },
          required: ['header'],
        })
        .rule((ctx, { header }) =>
          ctx.validateCommonHttpTransactions({
            appliesTo: statusCode(201),
            violatedWhen: (req, res, location) => [
              {
                location,
                ...(res.headers.includes(header)
                  ? {}
                  : { violation: { message: `missing ${header}` } }),
                findings: [
                  { kind: 'informational', title: `looked at ${req.path}` },
                ],
              },
            ],
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
      const astronautCreated = addTransaction(
        format,
        createPostRequest({ path: '/astronauts' }),
        createCreatedResponse(),
      );

      const executions = await runRule(rule, {
        options: { header: 'location' },
      }).test(format);

      expect(executions).toMatchObject([
        {
          location: { elementId: launchCreated },
          status: 'passed',
          findings: [{ kind: 'informational', title: 'looked at /launches' }],
        },
        {
          location: { elementId: astronautCreated },
          status: 'failed',
          severity: 'off',
          message: 'missing location',
          findings: [{ kind: 'informational', title: 'looked at /astronauts' }],
        },
      ]);
      expect(executions.flatMap(({ findings }) => findings)).toHaveLength(2);
    });
  });
});
