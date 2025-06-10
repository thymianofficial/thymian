import { NoopLogger } from '@thymian/core';
import { describe, it } from 'vitest';

import { httpTest } from '../src/http-test.js';
import { createHttpTestContext } from '../src/http-test-context.js';
import { authorizeRequests } from '../src/operators/authorize-requests.operator.js';
import { forHttpTransactions } from '../src/operators/for-http-transactions.operator.js';
import { generateRequests } from '../src/operators/generate-requests.operator.js';
import { runRequests } from '../src/operators/run-requests.operator.js';
import { toTestCases } from '../src/operators/to-test-cases.operator.js';
import { buildTodosApp } from './fixture/todo-app/app.js';
import { todoFormat } from './fixture/todo-app/todo.format.js';
import {
  createRequestRunner,
  exampleContentGenerator,
  identityHookRunner,
} from './utils.js';

describe('httpTest', () => {
  it('server', async () => {
    const app = buildTodosApp({ logger: true });

    const r = await app.inject().get('/todos?title=co de').end();

    console.log(r.body);
  });

  it('for todos app', async () => {
    const test = httpTest('GET requests', (test) =>
      test.pipe(
        forHttpTransactions({ method: 'GET' }, { statusCode: 200 }),
        toTestCases(),
        generateRequests(),
        authorizeRequests(),
        runRequests()
      )
    );

    const todoApp = buildTodosApp();

    const context = createHttpTestContext({
      format: todoFormat,
      logger: new NoopLogger(),
      runHook: identityHookRunner,
      runRequest: createRequestRunner(todoApp),
      generateContent: exampleContentGenerator,
      auth: {
        basic: () => Promise.resolve(['matthyk', 'qupaya']),
      },
    });

    const result = await test(context);

    console.log(JSON.stringify(result));
  });
});
