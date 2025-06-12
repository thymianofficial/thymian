import { describe, it } from 'vitest';

import { StringSchemaBuilder } from '../../../src/format/schema/primitives/string.schema.js';

describe('', () => {
  it('should ', () => {
    const schema = new StringSchemaBuilder().withExample('haha').build();

    console.log(schema);
  });
});
