import { join } from 'node:path';

import { ThymianFormat } from '@thymian/core';
import { describe, it } from 'vitest';

import { ContentGenerator } from '../../src/content-generator/content-generator.js';
import { ImageContentTypeStrategy } from '../../src/content-generator/image.content-type-strategy.js';
import { JsonContentTypeStrategy } from '../../src/content-generator/json.content-type-strategy.js';
import { XmlContentTypeStrategy } from '../../src/content-generator/xml.content-type-strategy.js';
import { FileOutputWriter } from '../../src/output-writer/file.output-writer.js';
import { generate } from '../../src/request-generators/generate.js';

describe('generate', () => {
  it('should work', async () => {
    const format = new ThymianFormat();

    const reqId = format.addRequest({
      label:
        'GET http://localhost:8081/tools.descartes.teastore.persistence/rest/users/name/{username}',
      type: 'http-request',
      host: 'localhost',
      port: 8081,
      protocol: 'http',
      path: 'tools.descartes.teastore.persistence/rest/users/name/{username}',
      method: 'get',
      mediaType: '',
      extensions: {
        openapi: {
          operationId: 'getUserByName',
        },
      },
      cookies: {},
      pathParameters: {
        username: {
          required: true,
          schema: {
            type: 'string',
          },
          style: {
            style: 'simple',
            explode: false,
          },
        },
      },
      queryParameters: {},
      headers: {},
    });

    const [, tId] = format.addResponseToRequest(reqId, {
      label: '200 OK - application/json',
      type: 'http-response',
      description: 'OK',
      headers: {},
      mediaType: 'application/json',
      statusCode: 200,
      schema: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
          },
          userName: {
            type: 'string',
          },
          realName: {
            type: 'string',
          },
          password: {
            type: 'string',
          },
          email: {
            type: 'string',
            format: 'email',
          },
        },
      },
    });

    const t = format.getThymianHttpTransactions()[0]!;

    const g = new ContentGenerator([], new JsonContentTypeStrategy());

    const writer = new FileOutputWriter(join(import.meta.dirname, 'tmp'), true);

    await generate(format, t, g, writer);
  });

  it('should generate image type', async () => {
    const format = new ThymianFormat();

    const reqId = format.addRequest({
      cookies: {},
      headers: {},
      host: 'localhost',
      mediaType: 'application/xml',
      method: 'POST',
      path: '/test',
      pathParameters: {},
      body: {
        xml: {
          name: 'haha',
        },
        type: 'object',
        properties: {
          a: { type: 'integer', exclusiveMinimum: 10 },
          b: { type: 'string', format: 'password', minLength: 10 },
        },
      },
      port: 8080,
      protocol: 'http',
      queryParameters: {},
      type: 'http-request',
    });

    format.addResponseToRequest(reqId, {
      headers: {},
      mediaType: '',
      statusCode: 200,
      type: 'http-response',
    });

    const t = format.getThymianHttpTransactions()[0]!;

    const g = new ContentGenerator(
      [new XmlContentTypeStrategy()],
      new ImageContentTypeStrategy()
    );

    const writer = new FileOutputWriter(join(import.meta.dirname, 'tmp'), true);

    await generate(format, t, g, writer);
  });
});
