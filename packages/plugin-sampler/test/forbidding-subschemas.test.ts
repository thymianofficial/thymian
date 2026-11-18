import { describe, expect, it } from 'vitest';

import { forbiddingSubschemasToBoolean } from '../src/generation/forbidding-subschemas.js';

describe('forbiddingSubschemasToBoolean', () => {
  it.each(['additionalProperties', 'items'])(
    'should turn a forbidding %s back into false',
    (keyword) => {
      expect(forbiddingSubschemasToBoolean({ [keyword]: { not: {} } })).toEqual(
        { [keyword]: false },
      );
    },
  );

  it.each(['additionalProperties', 'items'])(
    'should reach a forbidding %s nested in properties, items and $defs',
    (keyword) => {
      const forbidding = { [keyword]: { not: {} } };
      const restored = { [keyword]: false };

      expect(
        forbiddingSubschemasToBoolean({
          properties: { a: forbidding },
          items: forbidding,
          $defs: { B: forbidding },
        }),
      ).toEqual({
        properties: { a: restored },
        items: restored,
        $defs: { B: restored },
      });
    },
  );

  it('should leave `not: {}` in every other position alone', () => {
    const schema = {
      properties: { never: { not: {} } },
      propertyNames: { not: {} },
    };

    expect(forbiddingSubschemasToBoolean(schema)).toEqual(schema);
  });

  it.each(['additionalProperties', 'items'])(
    'should leave a %s that admits something alone',
    (keyword) => {
      const schema = {
        [keyword]: { not: { type: 'string' } },
        properties: { a: { [keyword]: { type: 'string' } } },
      };

      expect(forbiddingSubschemasToBoolean(schema)).toEqual(schema);
    },
  );

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
