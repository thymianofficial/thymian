import { join } from 'node:path';

import { ThymianFormat } from '@thymian/core';
import { describe, it } from 'vitest';

import { ContentGenerator } from '../../src/content-generator/content-generator.js';
import { ImageContentTypeStrategy } from '../../src/content-generator/image.content-type-strategy.js';
import { XmlContentTypeStrategy } from '../../src/content-generator/xml.content-type-strategy.js';
import { FileOutputWriter } from '../../src/output-writer/file.output-writer.js';
import { generate } from '../../src/request-generators/generate.js';

describe('generate', () => {
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
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
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

    const [resId] = format.addResponseToRequest(reqId, {
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

    const writer = new FileOutputWriter(join(import.meta.dirname, 'tmp'));

    await generate(format, t, g, writer);
  });
});
