import {
  httpTransactionToLabel,
  NoopLogger,
  ThymianFormat,
} from '@thymian/core';
import { describeRuleContextScenarios } from '@thymian/core-testing';
import { expect, onTestFinished } from 'vitest';

import { AnalyticsApiContext } from '../src/analytics-api-context.js';
import { SqliteHttpTransactionRepository } from '../src/db/sqlite-http-transaction-repository.js';

describeRuleContextScenarios({
  name: 'analyze',
  observes: 'actual pair',
  notApplicable: {
    isAuthorized:
      'the analyzer translates appliesTo to SQL, which cannot ask whether the described request is secured',
  },
  async setup(transactions) {
    const logger = new NoopLogger();
    const repository = new SqliteHttpTransactionRepository(':memory:', logger);
    await repository.init();
    onTestFinished(() => repository.close());

    const format = new ThymianFormat();
    for (const { described, actual } of transactions) {
      repository.insertHttpTransaction({
        request: { data: actual.request, meta: {} },
        response: { data: actual.response, meta: {} },
      });
      format.addHttpTransaction(
        described.request,
        described.response,
        'test-source',
      );
    }

    return {
      context: new AnalyticsApiContext({ repository, logger, format }),
      locationOf: (index, contextMethod) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const { request, response } = transactions[index]!.actual;
        const label = httpTransactionToLabel(request, response);
        // Only validateHttpTransactions anchors a recorded pair to the
        // described transaction it matches; otherwise the label locates it.
        const transactionId = format.matchTransaction(request, response)?.[0];

        return contextMethod === 'validateHttpTransactions' && transactionId
          ? expect.objectContaining({
              elementType: 'edge',
              elementId: transactionId,
              label,
            })
          : label;
      },
    };
  },
});
