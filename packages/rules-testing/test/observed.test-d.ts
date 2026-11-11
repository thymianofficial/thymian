import { type Rule, ThymianFormat } from '@thymian/core';
import { describe, expectTypeOf, it } from 'vitest';

import {
  checkInput,
  type InputOf,
  type ObservedInput,
  type ObservedTransaction,
  type RuleFixtures,
} from '../src/index.js';

declare const rule: Rule;
declare const row: ObservedTransaction;

const observed: ObservedInput = { observed: [row] };

describe('ObservedInput', () => {
  it('is an input of every context', () => {
    expectTypeOf(observed).toExtend<InputOf<'static'>>();
    expectTypeOf(observed).toExtend<InputOf<'test'>>();
    expectTypeOf(observed).toExtend<InputOf<'analytics'>>();
  });

  it('is accepted by checkInput and RuleFixtures', () => {
    void checkInput('static', rule, observed, 'violates');
    void checkInput('test', rule, observed, 'conforms');
    void checkInput('analytics', rule, observed, 'violates');

    const fixtures: RuleFixtures = {
      rule,
      static: { violates: observed, conforms: observed },
      test: { violates: observed, conforms: observed },
      analytics: { violates: observed, conforms: observed },
    };
    expectTypeOf(fixtures).toExtend<RuleFixtures>();
  });

  it('does not mix with the fields of the other inputs', () => {
    const format = new ThymianFormat();

    // @ts-expect-error `observed` replaces the format
    const staticInput: InputOf<'static'> = { observed: [row], format };
    // @ts-expect-error `observed` replaces the router
    const testInput: InputOf<'test'> = {
      observed: [row],
      runRequest: async () => ({
        statusCode: 200,
        headers: {},
        trailers: {},
        duration: 1,
      }),
    };

    // @ts-expect-error `observed` replaces the recorded transactions
    const analyticsInput: InputOf<'analytics'> = {
      observed: [row],
      transactions: [],
    };
    // @ts-expect-error an observed list carries no traces
    const tracedInput: InputOf<'analytics'> = { observed: [row], traces: [] };

    void staticInput;
    void testInput;
    void analyticsInput;
    void tracedInput;
  });
});
