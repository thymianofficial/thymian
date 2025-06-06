import { describe, expect, it } from 'vitest';

import { JsonDataServer } from '../src';

describe('json-data-generator-osx-arm64', () => {
  it('should work', async () => {
    const controller = new AbortController();

    const obj = await new JsonDataServer(controller.signal).request({
      type: 'object',
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          minLength: 2,
          maxLength: 2,
        },
      },
    });

    expect(obj).toMatchObject({
      name: expect.stringMatching(/^.{2}$/),
    });

    controller.abort();
  });
});
