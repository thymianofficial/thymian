// The code examples of the rule-author guide
// (astro-docs/src/content/docs/guides/HTTP rules/testing-rules.md) are taken
// from this file and from the two rules in ./rules. Change an example here
// first, and the guide with it.
import { httpRule, not, responseHeader, statusCode, url } from '@thymian/core';
import {
  addTransaction,
  createBadRequestResponse,
  createCreatedResponse,
  createGetRequest,
  createNotFoundResponse,
  createOkResponse,
  createPostRequest,
  createPutRequest,
  createRequiredParameter,
  createStringSchema,
  createThymianFormat,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { recorded, runRule } from '../src/index.js';
import { clientErrorsAreProblemJson } from './rules/client-errors-are-problem-json.js';
import { createdResponsesHaveLocation } from './rules/created-responses-have-location.js';

describe('the rule-author guide: testing a rule', () => {
  const format = createThymianFormat();

  const launchesListed = addTransaction(
    format,
    createGetRequest({ path: '/launches' }),
    createOkResponse(),
  );
  const launchCreated = addTransaction(
    format,
    createPostRequest({ path: '/launches' }),
    createCreatedResponse({ headers: { location: createRequiredParameter() } }),
  );

  // A path parameter needs an example, so that a request can be built for it.
  const getLaunch = createGetRequest({
    path: '/launches/{id}',
    pathParameters: {
      id: createRequiredParameter({
        schema: createStringSchema({ examples: ['apollo-11'] }),
      }),
    },
  });
  // One operation with two answers is two transactions on the same request.
  const launchFound = addTransaction(format, getLaunch, createOkResponse());
  const launchMissing = addTransaction(
    format,
    getLaunch,
    createNotFoundResponse({ mediaType: 'application/problem+json' }),
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
    createBadRequestResponse({ mediaType: 'application/json' }),
  );

  describe('every declared context', () => {
    it('created-responses-have-location says the same in static, test and analytics', async () => {
      const run = runRule(createdResponsesHaveLocation);

      const expected = [
        { location: { elementId: launchesListed }, status: 'notApplicable' },
        { location: { elementId: launchCreated }, status: 'passed' },
        { location: { elementId: launchFound }, status: 'notApplicable' },
        { location: { elementId: launchMissing }, status: 'notApplicable' },
        {
          location: { elementId: astronautCreated },
          status: 'failed',
          severity: 'warn',
          message:
            'A 201 Created response must name the new resource in a Location header',
        },
        { location: { elementId: astronautRejected }, status: 'notApplicable' },
      ];

      expect(await run.static(format)).toMatchObject(expected);
      expect(await run.test(format)).toMatchObject(expected);
      expect(await run.analytics(format)).toMatchObject(expected);
    });

    it('client-errors-are-problem-json says the same in static, test and analytics', async () => {
      const run = runRule(clientErrorsAreProblemJson);

      const expected = [
        { location: { elementId: launchesListed }, status: 'notApplicable' },
        { location: { elementId: launchCreated }, status: 'notApplicable' },
        { location: { elementId: launchFound }, status: 'notApplicable' },
        { location: { elementId: launchMissing }, status: 'passed' },
        { location: { elementId: astronautCreated }, status: 'notApplicable' },
        {
          location: { elementId: astronautRejected },
          status: 'failed',
          severity: 'error',
          message: 'A 4xx response must answer as application/problem+json',
        },
      ];

      expect(await run.static(format)).toMatchObject(expected);
      expect(await run.test(format)).toMatchObject(expected);
      expect(await run.analytics(format)).toMatchObject(expected);
    });

    it('lists every transaction of the format, each with a readable label', async () => {
      const executions = await runRule(createdResponsesHaveLocation).static(
        format,
      );

      expect(executions).toHaveLength(6);
      expect(executions[4]).toMatchObject({
        location: {
          elementType: 'edge',
          elementId: astronautCreated,
          label:
            'POST /astronauts (application/json) -> 201 (application/json)',
        },
        status: 'failed',
        severity: 'warn',
        message:
          'A 201 Created response must name the new resource in a Location header',
        findings: [],
      });
    });

    it('throws for a context the rule does not declare', async () => {
      const lintOnly = httpRule('demo/lint-only')
        .severity('error')
        .type('static')
        .rule((ctx) =>
          ctx.validateCommonHttpTransactions({
            appliesTo: statusCode(201),
            violatedWhen: not(responseHeader('location')),
          }),
        )
        .done();

      await expect(runRule(lintOnly).test(format)).rejects.toThrow(
        'Rule "demo/lint-only" does not declare the "test" context. It declares: static.',
      );
    });
  });

  describe('a rule that decides applicability in a plain callback', () => {
    it('gets passed for every transaction it did not flag', async () => {
      const decidesInACallback = httpRule('demo/decides-in-a-callback')
        .severity('warn')
        .type('static')
        .summary('A 201 Created response must name the new resource')
        .rule((ctx) =>
          ctx.validateHttpTransactions({
            appliesTo: (_request, response) => response.statusCode === 201,
            violatedWhen: (_request, response) =>
              !('location' in response.headers),
          }),
        )
        .done();

      expect(await runRule(decidesInACallback).static(format)).toMatchObject([
        { location: { elementId: launchesListed }, status: 'passed' },
        { location: { elementId: launchCreated }, status: 'passed' },
        { location: { elementId: launchFound }, status: 'passed' },
        { location: { elementId: launchMissing }, status: 'passed' },
        { location: { elementId: astronautCreated }, status: 'failed' },
        { location: { elementId: astronautRejected }, status: 'passed' },
      ]);
    });
  });

  describe('a server that deviates, in test', () => {
    it('fails the transaction whose declared header the server drops', async () => {
      const executions = await runRule(createdResponsesHaveLocation).test(
        format,
        {
          respond: ({ transaction, conforming }) =>
            transaction === launchCreated
              ? { ...conforming, headers: {} }
              : conforming,
        },
      );

      expect(executions[1]).toMatchObject({
        location: { elementId: launchCreated },
        status: 'failed',
      });
    });

    it('skips the transaction the server answers with another status than declared', async () => {
      const executions = await runRule(createdResponsesHaveLocation).test(
        format,
        {
          respond: ({ transaction, conforming }) =>
            transaction === launchCreated
              ? { ...conforming, statusCode: 500 }
              : conforming,
        },
      );

      expect(executions[1]).toMatchObject({
        location: { elementId: launchCreated },
        status: 'skipped',
        reason: expect.stringContaining(
          'Expected status code 201, but received 500',
        ),
      });
    });

    it('changes many answers with one condition', async () => {
      const executions = await runRule(clientErrorsAreProblemJson).test(
        format,
        {
          respond: ({ conforming }) =>
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
        { location: { elementId: launchesListed }, status: 'notApplicable' },
        { location: { elementId: launchCreated }, status: 'notApplicable' },
        { location: { elementId: launchFound }, status: 'notApplicable' },
        { location: { elementId: launchMissing }, status: 'failed' },
        { location: { elementId: astronautCreated }, status: 'notApplicable' },
        { location: { elementId: astronautRejected }, status: 'failed' },
      ]);
    });
  });

  describe('traffic handed in, in analytics', () => {
    it('judges each recording of a transaction recorded twice on its own', async () => {
      const executions = await runRule(createdResponsesHaveLocation).analytics(
        format,
        {
          traffic: [
            recorded(format, launchCreated),
            recorded(format, launchCreated, { response: { headers: {} } }),
          ],
        },
      );

      expect(executions).toMatchObject([
        // The recordings, in traffic order
        { location: { elementId: launchCreated }, status: 'passed' },
        { location: { elementId: launchCreated }, status: 'failed' },
        // Then the transactions that were never recorded
        { location: { elementId: launchesListed }, status: 'notApplicable' },
        { location: { elementId: launchFound }, status: 'notApplicable' },
        { location: { elementId: launchMissing }, status: 'notApplicable' },
        { location: { elementId: astronautCreated }, status: 'notApplicable' },
        { location: { elementId: astronautRejected }, status: 'notApplicable' },
      ]);
    });

    it('gives the conforming pair of a transaction as plain HTTP objects', () => {
      expect(recorded(format, launchMissing)).toMatchObject({
        request: {
          method: 'GET',
          origin: 'https://localhost:443',
          path: '/launches/apollo-11',
        },
        response: {
          statusCode: 404,
          headers: { 'content-type': 'application/problem+json' },
        },
      });
    });

    it('keeps the declared content-type when headers are overridden, unless they name one', () => {
      const kept = recorded(format, launchMissing, {
        response: { headers: { 'retry-after': '120' } },
      });
      const replaced = recorded(format, launchMissing, {
        response: { headers: { 'content-type': 'text/html' } },
      });

      expect(kept.response.headers).toEqual({
        'retry-after': '120',
        'content-type': 'application/problem+json',
      });
      expect(replaced.response.headers).toEqual({
        'content-type': 'text/html',
      });
    });

    it('no longer recognises the transaction in a recording that names another content-type', async () => {
      const executions = await runRule(clientErrorsAreProblemJson).analytics(
        format,
        {
          traffic: [
            recorded(format, launchMissing, {
              response: { headers: { 'content-type': 'text/html' } },
            }),
          ],
        },
      );

      expect(executions).toMatchObject([
        { location: { elementId: launchesListed }, status: 'notApplicable' },
        { location: { elementId: launchCreated }, status: 'notApplicable' },
        { location: { elementId: launchFound }, status: 'notApplicable' },
        { location: { elementId: launchMissing }, status: 'notApplicable' },
        { location: { elementId: astronautCreated }, status: 'notApplicable' },
        { location: { elementId: astronautRejected }, status: 'notApplicable' },
        { location: expect.stringContaining('/launches'), status: 'failed' },
      ]);
    });

    it('locates a recording that matches no transaction on a free string, last', async () => {
      const executions = await runRule(createdResponsesHaveLocation).analytics(
        format,
        {
          traffic: [
            recorded(format, launchCreated, {
              request: { path: '/probes' },
              response: { headers: {} },
            }),
          ],
        },
      );

      expect(executions.at(-1)).toMatchObject({
        location: expect.stringContaining('/probes'),
        status: 'failed',
      });
    });
  });

  describe('a path parameter without an example', () => {
    const withoutExample = createThymianFormat();
    const probeFound = addTransaction(
      withoutExample,
      createGetRequest({ path: '/probes/{id}' }),
      createCreatedResponse(),
    );

    it('is skipped in test, with the reason', async () => {
      expect(
        await runRule(createdResponsesHaveLocation).test(withoutExample),
      ).toMatchObject([
        {
          location: { elementId: probeFound },
          status: 'skipped',
          reason: 'Missing value for path parameter "id".',
        },
      ]);
    });

    it('makes analytics throw, because there is nothing to record', async () => {
      await expect(
        runRule(createdResponsesHaveLocation).analytics(withoutExample),
      ).rejects.toThrow('Missing value for path parameter "id".');
    });
  });
});

describe('the rule-author guide: testing a grouped rule', () => {
  const message = 'A resource sends ETag on every 200 answer or on none';

  // Blames one member: the answer without an ETag.
  const answersCarryTheEtagOfTheirResource = httpRule(
    'demo/answers-carry-the-etag-of-their-resource',
  )
    .severity('error')
    .type('static', 'analytics', 'test')
    .summary(message)
    .rule((ctx) =>
      ctx.validateGroupedCommonHttpTransactions({
        appliesTo: statusCode(200),
        groupBy: url(),
        violatedWhen: (_key, answers) => {
          const withoutEtag = answers.filter(
            ([, response]) => !response.headers.includes('etag'),
          );

          return withoutEtag.length === answers.length
            ? []
            : withoutEtag.map(([, , location]) => ({
                location,
                violation: {},
                findings: [],
              }));
        },
      }),
    )
    .done();

  // Blames the group: the resource as a whole.
  const resourcesSendEtagConsistently = httpRule(
    'demo/resources-send-etag-consistently',
  )
    .severity('error')
    .type('static', 'analytics', 'test')
    .summary(message)
    .rule((ctx) =>
      ctx.validateGroupedCommonHttpTransactions({
        appliesTo: statusCode(200),
        groupBy: url(),
        violatedWhen: (key, answers) => {
          const withEtag = answers.filter(([, response]) =>
            response.headers.includes('etag'),
          );

          return withEtag.length === 0 || withEtag.length === answers.length
            ? []
            : [{ location: key, violation: {}, findings: [] }];
        },
      }),
    )
    .done();

  const format = createThymianFormat();
  const launchRead = addTransaction(
    format,
    createGetRequest({ path: '/launches' }),
    createOkResponse({ headers: { etag: createRequiredParameter() } }),
  );
  const launchReplaced = addTransaction(
    format,
    createPutRequest({ path: '/launches' }),
    createOkResponse(),
  );
  const launchCreated = addTransaction(
    format,
    createPostRequest({ path: '/launches' }),
    createCreatedResponse(),
  );
  const astronautRead = addTransaction(
    format,
    createGetRequest({ path: '/astronauts' }),
    createOkResponse(),
  );

  it('shows the member a rule blames as failed and its sibling as passed', async () => {
    const run = runRule(answersCarryTheEtagOfTheirResource);

    const expected = [
      { location: { elementId: launchRead }, status: 'passed' },
      { location: { elementId: launchReplaced }, status: 'failed', message },
      { location: { elementId: launchCreated }, status: 'notApplicable' },
      { location: { elementId: astronautRead }, status: 'passed' },
    ];

    expect(await run.static(format)).toMatchObject(expected);
    expect(await run.test(format)).toMatchObject(expected);
    expect(await run.analytics(format)).toMatchObject(expected);
  });

  it('shows every member of a group a rule blames as failed, with the group key', async () => {
    const run = runRule(resourcesSendEtagConsistently);

    const blamed = {
      status: 'failed',
      message,
      group: expect.stringContaining('/launches'),
    };
    const expected = [
      { location: { elementId: launchRead }, ...blamed },
      { location: { elementId: launchReplaced }, ...blamed },
      { location: { elementId: launchCreated }, status: 'notApplicable' },
      { location: { elementId: astronautRead }, status: 'passed' },
    ];

    expect(await run.static(format)).toMatchObject(expected);
    expect(await run.test(format)).toMatchObject(expected);
    expect(await run.analytics(format)).toMatchObject(expected);
  });

  it('spells the group key as the context spells it', async () => {
    const run = runRule(resourcesSendEtagConsistently);

    const [inStatic] = await run.static(format);
    const [inAnalytics] = await run.analytics(format);

    expect(inStatic?.group).toBe('https://localhost:443/launches');
    expect(inAnalytics?.group).toBe('https://localhost/launches');
  });

  it('lists a blamed group on every recording of a transaction recorded twice', async () => {
    const executions = await runRule(resourcesSendEtagConsistently).analytics(
      format,
      {
        traffic: [
          recorded(format, launchRead),
          recorded(format, launchReplaced),
          recorded(format, launchReplaced),
        ],
      },
    );

    expect(executions).toMatchObject([
      { location: { elementId: launchRead }, status: 'failed' },
      { location: { elementId: launchReplaced }, status: 'failed' },
      { location: { elementId: launchReplaced }, status: 'failed' },
      { location: { elementId: launchCreated }, status: 'notApplicable' },
      { location: { elementId: astronautRead }, status: 'notApplicable' },
    ]);
  });
});
