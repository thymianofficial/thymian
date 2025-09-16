import { describe, expect, it } from 'vitest';

import { processParameterObjects } from '../../src/processors/parameter-object.processor.js';

describe('processParameterObjects', () => {
  it('should process path parameter', () => {
    const parameters = processParameterObjects([
      {
        name: 'username',
        in: 'path',
        required: true,
        schema: {
          type: 'string',
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          examples: ['user1'],
        },
      },
    ]);

    expect(parameters).toMatchObject({
      headers: {},
      queryParameters: {},
      cookies: {},
      pathParameters: {
        username: {
          required: true,
          schema: {
            type: 'string',
            examples: ['user1'],
          },
        },
      },
    });
  });
});
