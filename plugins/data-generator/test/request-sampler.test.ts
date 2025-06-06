import { describe, expect, it } from 'vitest';
import {
  HeaderSerializationStyle,
  NoopLogger,
  ObjectSchema,
  StringSchema,
  ThymianFormat,
} from '@thymian/core';
import { JsonDataServer } from '@thymian/json-data-generator-osx-arm64';
import { MemoryOutputWriter } from '../src/output-writer/memory.output-writer.js';
import { HttpRequestSampler } from '../src/request-sampler.js';
import { ContentGenerator } from '../src/content-generator.js';
import { JsonContentTypeStrategy } from '../src/content-types/json.content-type-strategy.js';
import { FileOutputWriter } from '../src/output-writer/file.output-writer.js';
import { ImageContentTypeStrategy } from '../src/content-types/image.content-type-strategy.js';

describe('request sampler', () => {
  it('Should return examples if available', async () => {
    const logger = new NoopLogger();

    const format = new ThymianFormat();

    const reqId = format.addRequest({
      body: new ObjectSchema(), //.withExample({ name: 'matthyk', age: 26 }),
      bodyRequired: true,
      cookies: {},
      description: '',
      encoding: undefined,
      extensions: undefined,
      headers: {
        'x-api-key': {
          schema: new StringSchema()
            .withMinLength(10)
            .withMaxLength(20)
            .withExample('my-secret'),
          required: false,
          style: new HeaderSerializationStyle(),
        },
      },
      host: '',
      mediaType: 'image/png',
      method: '',
      path: '',
      pathParameters: {},
      port: 8080,
      protocol: 'http',
      queryParameters: {},
      type: 'http-request',
    });

    const controller = new AbortController();

    const jds = new JsonDataServer(controller.signal, 44445);

    //const out = new MemoryOutputWriter();
    const fileWriter = new FileOutputWriter(
      '/Users/matthias/University/2024-ma-matthias-keckl-thymian/plugins/data-generator/test/.thymian'
    );

    const sampler = new HttpRequestSampler(
      logger,
      format,
      new ContentGenerator(
        [new JsonContentTypeStrategy(jds), new ImageContentTypeStrategy()],
        new JsonContentTypeStrategy(jds)
      ),
      fileWriter,
      {
        numberOfSamples: 1,
      }
    );

    await sampler.generate();

    // expect(out.samples.get(reqId)).toHaveLength(1);
    // expect(out.samples.get(reqId)?.[0]).toMatchObject({
    //   body: {
    //     name: 'matthyk',
    //     age: 26,
    //   },
    //   cookies: {},
    //   queryParameters: {},
    //   pathParameters: {},
    //   headers: {
    //     'x-api-key': 'my-secret',
    //   },
    // });

    controller.abort();
  });
});
