import {
  createHttpTestContext,
  type HttpRequestTemplate,
  NoopLogger,
  ThymianFormat,
} from '@thymian/core';
import {
  describeRuleContextScenarios,
  type ScenarioTransaction,
} from '@thymian/core-testing';
import { expect, vi } from 'vitest';

import { HttpTestApiContext } from '../src/http-test-api-context.js';

function actualPairAt(
  transactions: ScenarioTransaction[],
  path: string,
): ScenarioTransaction['actual'] {
  const transaction = transactions.find((t) => t.actual.request.path === path);
  if (!transaction) {
    throw new Error(`No scenario transaction for path ${path}.`);
  }
  return transaction.actual;
}

describeRuleContextScenarios({
  name: 'test',
  observes: 'actual pair',
  async setup(transactions) {
    const format = new ThymianFormat();
    const transactionIds = transactions.map(({ described }) => {
      const [reqId, , transactionId] = format.addHttpTransaction(
        described.request,
        described.response,
        'test-source',
      );

      if (described.secured) {
        const schemeId = format.addSecurityScheme({
          label: 'basic',
          scheme: 'basic',
          sourceName: 'test-source',
          type: 'security-scheme',
        });
        format.addEdge(reqId, schemeId, {
          label: 'basic',
          type: 'is-secured',
          sourceName: 'test-source',
        });
      }

      return transactionId;
    });

    const ctx = createHttpTestContext({
      format,
      logger: new NoopLogger(),
      locals: {},
      sampleRequest: async (transaction): Promise<HttpRequestTemplate> => {
        const { request } = actualPairAt(
          transactions,
          transaction.thymianReq.path,
        );
        return {
          method: request.method,
          origin: request.origin,
          path: request.path,
          headers: request.headers ?? {},
          pathParameters: {},
          query: {},
          cookies: {},
          authorize: true,
        };
      },
      runRequest: async (request) =>
        actualPairAt(transactions, request.path).response,
      runHook: vi
        .fn()
        .mockImplementation(async (_name, hook) => ({ result: hook.value })),
    });

    return {
      context: new HttpTestApiContext('scenario-rule', ctx),
      locationOf: (index) =>
        expect.objectContaining({
          elementType: 'edge',
          elementId: transactionIds[index],
        }),
    };
  },
});
