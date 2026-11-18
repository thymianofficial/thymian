import { describe, expect, it } from 'vitest';

import { forbiddingSubschemasToBoolean } from '../src/generation/forbidding-subschemas.js';

describe('forbiddingSubschemasToBoolean', () => {
  it('should turn a forbidding additionalProperties back into false', () => {
    expect(
      forbiddingSubschemasToBoolean({
        type: 'object',
        additionalProperties: { not: {} },
      }),
    ).toEqual({ type: 'object', additionalProperties: false });
  });

  it('should turn a forbidding items back into false', () => {
    expect(
      forbiddingSubschemasToBoolean({
        type: 'array',
        items: { not: {} },
      }),
    ).toEqual({ type: 'array', items: false });
  });

  it('should reach closed objects nested in properties, items and $defs', () => {
    const closed = { additionalProperties: { not: {} } };

    expect(
      forbiddingSubschemasToBoolean({
        properties: { a: closed },
        items: closed,
        $defs: { B: closed },
      }),
    ).toEqual({
      properties: { a: { additionalProperties: false } },
      items: { additionalProperties: false },
      $defs: { B: { additionalProperties: false } },
    });
  });

  it('should reach closed arrays nested in properties, items and $defs', () => {
    const closed = { type: 'array', items: { not: {} } };

    expect(
      forbiddingSubschemasToBoolean({
        properties: { a: closed },
        items: closed,
        $defs: { B: closed },
      }),
    ).toEqual({
      properties: { a: { type: 'array', items: false } },
      items: { type: 'array', items: false },
      $defs: { B: { type: 'array', items: false } },
    });
  });

  it('should leave `not: {}` in every other position alone', () => {
    const schema = {
      properties: { never: { not: {} } },
      propertyNames: { not: {} },
    };

    expect(forbiddingSubschemasToBoolean(schema)).toEqual(schema);
  });

  it('should leave an additionalProperties that admits something alone', () => {
    const schema = {
      additionalProperties: { not: { type: 'string' } },
      properties: { a: { additionalProperties: { type: 'string' } } },
    };

    expect(forbiddingSubschemasToBoolean(schema)).toEqual(schema);
  });

  it('should leave an items that admits something alone', () => {
    const schema = {
      items: { not: { type: 'string' } },
      properties: { a: { items: { type: 'string' } } },
    };

    expect(forbiddingSubschemasToBoolean(schema)).toEqual(schema);
  });

  it('should rewrite a key named additionalProperties or items wherever it sits', () => {
    // Known and accepted: the walk is keyed on the name, not on the position,
    // and only fires on exactly `{ not: {} }`.
    expect(
      forbiddingSubschemasToBoolean({
        properties: {
          additionalProperties: { not: {} },
          items: { not: {} },
        },
      }),
    ).toEqual({ properties: { additionalProperties: false, items: false } });
  });

  it('should not mutate its input', () => {
    const schema = {
      additionalProperties: { not: {} },
      properties: { a: { items: { not: {} } } },
    };

    forbiddingSubschemasToBoolean(schema);

    expect(schema).toEqual({
      additionalProperties: { not: {} },
      properties: { a: { items: { not: {} } } },
    });
  });
});
