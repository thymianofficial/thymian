import { describe, expect, it } from 'vitest';

import { serializePathParameter } from '../src/http-testing/serialize-parameter.js';
import { SerializationStyleBuilder } from '../src/index.js';

describe('serializePathParameter', () => {
  it('Should serialize path parameter - default style', () => {
    const serialized = serializePathParameter(
      'id',
      [2, 3, 5, 7],
      new SerializationStyleBuilder('simple', false).build(),
    );

    expect(serialized).toStrictEqual('2,3,5,7');
  });
});
