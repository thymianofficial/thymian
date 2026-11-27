import {
  and,
  constant,
  explicitlyDocumented,
  httpRule,
  statusCode,
} from '@thymian/core';
import {
  addTransaction,
  createGetRequest,
  createHttpResponse,
  createThymianFormat,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { createRuleTester, recorded } from '../src/index.js';

/** A rule about one status code that leaves range-derived responses alone. */
const paymentRequiredIsReserved = httpRule('test/402-is-reserved')
  .severity('error')
  .type('static', 'test', 'analytics')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions({
      appliesTo: and(statusCode(402), explicitlyDocumented()),
      violatedWhen: constant(true),
    }),
  )
  .done();

/**
 * A format with a 402 documented under its own code, a 402 only `4XX`
 * implies, and a `default` response.
 */
function apiWithExplicitRangeDerivedAndDefault() {
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
  const documentedAsDefault = addTransaction(
    format,
    createGetRequest({ path: '/refunds' }),
    createHttpResponse({ statusCode: 'default' }),
  );

  return { format, explicit, rangeDerived, documentedAsDefault };
}

describe('a rule narrowed with explicitlyDocumented()', () => {
  it('does not flag a range-derived or default response in lint', async () => {
    const { format, explicit, rangeDerived, documentedAsDefault } =
      apiWithExplicitRangeDerivedAndDefault();

    const executions = await createRuleTester(
      paymentRequiredIsReserved,
    ).runLint(format);

    expect(executions).toMatchObject([
      { location: { elementId: explicit }, status: 'failed' },
      { location: { elementId: rangeDerived }, status: 'notApplicable' },
      { location: { elementId: documentedAsDefault }, status: 'notApplicable' },
    ]);
    expect(executions).toHaveLength(3);
  });

  it('sends no request for a range-derived transaction in test', async () => {
    const { format, explicit } = apiWithExplicitRangeDerivedAndDefault();
    const asked: string[] = [];

    await createRuleTester(paymentRequiredIsReserved).runTest(format, {
      respond: ({ transaction, conforming }) => {
        asked.push(transaction);
        return conforming;
      },
    });

    expect(asked).toEqual([explicit]);
  });

  it('flags the live response of an explicitly documented 402 in test', async () => {
    const { format, explicit } = apiWithExplicitRangeDerivedAndDefault();

    const executions = await createRuleTester(
      paymentRequiredIsReserved,
    ).runTest(format);

    expect(executions).toContainEqual(
      expect.objectContaining({
        location: expect.objectContaining({ elementId: explicit }),
        status: 'failed',
      }),
    );
  });

  it('reports a recorded 402 of a range-derived transaction in analyze', async () => {
    const { format, rangeDerived } = apiWithExplicitRangeDerivedAndDefault();

    const executions = await createRuleTester(
      paymentRequiredIsReserved,
    ).runAnalyze(format, { traffic: [recorded(format, rangeDerived)] });

    expect(executions).toContainEqual(
      expect.objectContaining({
        location: expect.objectContaining({ elementId: rangeDerived }),
        status: 'failed',
      }),
    );
  });
});
