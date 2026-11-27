import {
  addTransaction,
  createGetRequest,
  createHttpResponse,
  createThymianFormat,
} from '@thymian/core-testing';
import { createRuleTester, recorded } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import rule from './402-status-code-is-reserved.rule.js';

describe(rule.meta.name, () => {
  const ruleTester = createRuleTester(rule);

  // A 402 written out under its own code, and one that only `4XX` implies.
  function describedApi() {
    const format = createThymianFormat();
    const explicit = addTransaction(
      format,
      createGetRequest({ path: '/invoices' }),
      createHttpResponse({ statusCode: 402 }),
    );
    const rangeDerived = addTransaction(
      format,
      createGetRequest({ path: '/receipts' }),
      createHttpResponse({ statusCode: 402, derivedFromRange: '4XX' }),
    );

    return { format, explicit, rangeDerived };
  }

  it('flags, in lint, an explicit 402 but not one only 4XX implies', async () => {
    const { format, explicit, rangeDerived } = describedApi();

    const executions = await ruleTester.runLint(format);

    expect(executions).toMatchObject([
      {
        location: { elementId: explicit },
        status: 'failed',
        severity: 'error',
      },
      { location: { elementId: rangeDerived }, status: 'notApplicable' },
    ]);
  });

  it('reports, in analyze, a recorded 402 even where only 4XX documents it', async () => {
    const { format, rangeDerived } = describedApi();

    const executions = await ruleTester.runAnalyze(format, {
      traffic: [recorded(format, rangeDerived)],
    });

    expect(executions).toContainEqual(
      expect.objectContaining({
        location: expect.objectContaining({ elementId: rangeDerived }),
        status: 'failed',
      }),
    );
  });
});
