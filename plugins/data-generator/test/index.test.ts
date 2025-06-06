import {
  HeaderSerializationStyle,
  NoopLogger,
  ObjectSchema,
  StringSchema,
  ThymianFormat,
  ThymianSchema,
} from '@thymian/core';
import { JsonDataServer } from '@thymian/json-data-generator-osx-arm64';
import { describe, it } from 'vitest';

import { ContentGenerator } from '../src/content-generator.js';
import { JsonContentTypeStrategy } from '../src/content-types/json.content-type-strategy.js';
import { FileOutputWriter } from '../src/output-writer/file.output-writer.js';
import { HttpRequestSampler } from '../src/request-sampler.js';
import { MemoryOutputWriter } from '../src/output-writer/memory.output-writer.js';

describe('DataGenerator', () => {
  it('Should generate a data generator', async () => {
    const controller = new AbortController();

    const obj = await new JsonDataServer(controller.signal).request({
      type: 'number',
      minimum: 0,
      maximum: 100,
      multipleOf: 16,
    });

    console.log(obj);

    controller.abort();
  });

  it('test', async () => {
    const logger = new NoopLogger();

    const format = new ThymianFormat();

    format.addRequest({
      body: new ObjectSchema()
        .withProperty(
          'name',
          new StringSchema()
            .withMaxLength(20)
            .withMinLength(2)
            .withExample('matthyk')
        )
        .withAdditionalProperties(false),
      bodyRequired: true,
      cookies: {},
      description: '',
      encoding: undefined,
      extensions: undefined,
      headers: {
        test: {
          schema: new StringSchema()
            .withMinLength(10)
            .withMaxLength(20)
            .withExample('qupaya'),
          required: false,
          style: new HeaderSerializationStyle(),
        },
      },
      host: '',
      mediaType: '',
      method: '',
      path: '',
      pathParameters: {},
      port: 8080,
      protocol: 'http',
      queryParameters: {},
      type: 'http-request',
    });

    const schema = {
      type: 'object',
      properties: {},
    };

    const controller = new AbortController();

    const jds = new JsonDataServer(controller.signal, 44445);

    const out = new MemoryOutputWriter();

    const sampler = new HttpRequestSampler(
      logger,
      format,
      new ContentGenerator(
        [new JsonContentTypeStrategy(jds)],
        new JsonContentTypeStrategy(jds)
      ),
      out
    );

    await sampler.generate();

    console.log(JSON.stringify(Array.from(out.samples.entries())));

    controller.abort();
  });
});
