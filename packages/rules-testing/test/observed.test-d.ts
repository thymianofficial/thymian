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
  it('is an input of static and test', () => {
    expectTypeOf(observed).toExtend<InputOf<'static'>>();
    expectTypeOf(observed).toExtend<InputOf<'test'>>();
  });

  it('is accepted by checkInput and RuleFixtures', () => {
    void checkInput('static', rule, observed, 'violates');
    void checkInput('test', rule, observed, 'conforms');

    const fixtures: RuleFixtures = {
      rule,
      static: { violates: observed, conforms: observed },
      test: { violates: observed, conforms: observed },
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

    void staticInput;
    void testInput;
  });
});
