import {
  addTransaction,
  createBadRequestResponse,
  createCreatedResponse,
  createGetRequest,
  createNotFoundResponse,
  createOkResponse,
  createPostRequest,
  createRequiredParameter,
  createThymianFormat,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { runRule } from '../src/index.js';
import { clientErrorsAreProblemJson } from './rules/client-errors-are-problem-json.js';
import { createdResponsesHaveLocation } from './rules/created-responses-have-location.js';

describe('the demo rules in static', () => {
  it('created-responses-have-location: flags the 201 without a Location header', async () => {
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
    // One Operation with two answers is two Transactions on the same request.
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

    const executions = await runRule(createdResponsesHaveLocation).static(
      format,
    );

    expect(executions).toMatchObject([
      { location: { elementId: launchesListed }, status: 'notApplicable' },
      { location: { elementId: launchCreated }, status: 'passed' },
      {
        location: { elementId: astronautCreated },
        status: 'failed',
        severity: 'warn',
        message:
          'A 201 Created response must name the new resource in a Location header',
      },
      { location: { elementId: astronautRejected }, status: 'notApplicable' },
    ]);
    expect(executions).toHaveLength(4);
  });

  it('client-errors-are-problem-json: flags the 4xx that answers as plain JSON', async () => {
    const format = createThymianFormat();
    const getLaunch = createGetRequest({ path: '/launches/{id}' });
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

    const executions = await runRule(clientErrorsAreProblemJson).static(format);

    expect(executions).toMatchObject([
      { location: { elementId: launchFound }, status: 'notApplicable' },
      { location: { elementId: launchMissing }, status: 'passed' },
      { location: { elementId: astronautCreated }, status: 'notApplicable' },
      {
        location: { elementId: astronautRejected },
        status: 'failed',
        severity: 'error',
        message: 'A 4xx response must answer as application/problem+json',
      },
    ]);
    expect(executions).toHaveLength(4);
  });
});
