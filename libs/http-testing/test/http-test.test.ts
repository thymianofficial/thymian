import { NoopLogger } from '@thymian/core';
import {
  buildToDoApp,
  createFastifyRequestRunner,
  todoAppFormat,
} from '@thymian/test-utils';
import type { FastifyInstance } from 'fastify';
import { beforeEach, describe, it } from 'vitest';

import {
  createHttpTestContext,
  filterHttpTransactions,
  generateRequests,
  httpTest,
  type HttpTestContext,
  mapToTestCase,
  runRequests,
  validateResponses,
} from '../src/index.js';
import {
  exampleRequestSampler,
  identityHookRunner,
} from '../src/testing-utils/index.js';

describe('httpTest - todo app', () => {
  let exampleApp: FastifyInstance;
  let context: HttpTestContext;

  beforeEach(async () => {
    exampleApp = await buildToDoApp();
    context = createHttpTestContext({
      locals: {},
      format: todoAppFormat,
      logger: new NoopLogger(),
      runHook: identityHookRunner,
      runRequest: createFastifyRequestRunner(exampleApp),
      sampleRequest: exampleRequestSampler,
    });
  });

  it('All GET transactions with 200 response', async () => {
    const test = httpTest('GET requests', (transactions) =>
      transactions.pipe(
        filterHttpTransactions(
          { method: 'GET', path: '/projects/{id}' },
          { statusCode: 200 }
        ),
        mapToTestCase(),
        generateRequests(),
        runRequests(),
        validateResponses()
      )
    );

    const r = await test(context);
  });
});
