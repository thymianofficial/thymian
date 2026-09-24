import { NoopLogger, ThymianFormat } from '@thymian/core';
import { describeRuleContextScenarios } from '@thymian/core-testing';
import { expect } from 'vitest';

import { StaticApiContext } from '../../src/static-api-context.js';

describeRuleContextScenarios({
  name: 'lint',
  observes: 'specification',
  notApplicable: {
    validateHttpTransactions:
      'LintContext.validateHttpTransactions takes predicates over the described request and response instead of filter expressions; static-api-context.test.ts covers its named form',
  },
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

    return {
      context: new StaticApiContext(format, new NoopLogger()),
      locationOf: (index) =>
        expect.objectContaining({
          elementType: 'edge',
          elementId: transactionIds[index],
        }),
    };
  },
});
