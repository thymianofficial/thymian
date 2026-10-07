import { describe, expect, it } from 'vitest';

import { closedObjectsToBoolean } from '../src/generation/closed-schema.js';

describe('closedObjectsToBoolean', () => {
  it('should turn a forbidding additionalProperties back into false', () => {
    expect(
      closedObjectsToBoolean({
        type: 'object',
        additionalProperties: { not: {} },
      }),
    ).toEqual({ type: 'object', additionalProperties: false });
  });

  it('should reach closed objects nested in properties, items and $defs', () => {
    const closed = { additionalProperties: { not: {} } };

    expect(
      closedObjectsToBoolean({
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

  it('should leave `not: {}` in every other position alone', () => {
    const schema = {
      properties: { never: { not: {} } },
      propertyNames: { not: {} },
    };

    expect(closedObjectsToBoolean(schema)).toEqual(schema);
  });

  it('should leave an additionalProperties that admits something alone', () => {
    const schema = {
      additionalProperties: { not: { type: 'string' } },
      properties: { a: { additionalProperties: { type: 'string' } } },
    };

    expect(closedObjectsToBoolean(schema)).toEqual(schema);
  });

  it('should rewrite a key named additionalProperties wherever it sits', () => {
    // Known and accepted: the walk is keyed on the name, not on the position,
    // and only fires on exactly `{ not: {} }`.
    expect(
      closedObjectsToBoolean({
        properties: { additionalProperties: { not: {} } },
      }),
    ).toEqual({ properties: { additionalProperties: false } });
  });

  it('should not mutate its input', () => {
    const schema = { additionalProperties: { not: {} } };

    closedObjectsToBoolean(schema);

    expect(schema).toEqual({ additionalProperties: { not: {} } });
  });
});
