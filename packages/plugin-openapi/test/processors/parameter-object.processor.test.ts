import { describe, expect, it } from 'vitest';

import { processParameterObjects } from '../../src/processors/parameter-object.processor.js';

const document = {
  openapi: '3.1.0',
  info: {
    title: 'Test API',
    version: '1.0.0',
  },
  paths: {},
} as const;

describe('processParameterObjects', () => {
  it('should process path parameter', () => {
    const parameters = processParameterObjects(
      [
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
      ],
      document,
    );

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

  it('should resolve referenced parameters from the document', () => {
    const parameters = processParameterObjects(
      [{ $ref: '#/components/parameters/Username' }],
      {
        ...document,
        components: {
          parameters: {
            Username: {
              name: 'username',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          },
        },
      },
    );

    expect(parameters.pathParameters.username).toMatchObject({
      required: true,
      schema: { type: 'string' },
    });
  });
});
