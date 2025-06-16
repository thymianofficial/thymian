import {
  isNodeType,
  type Logger,
  type Parameter,
  type ThymianFormat,
  type ThymianHttpRequest,
} from '@thymian/core';

import type { ContentGenerator } from './content-generator.js';
import type { OutputWriter } from './output-writer/output-writer.js';
import type { SampleHttRequest } from './sample-request.js';

export type HttpRequestSamplerOptions = {
  numberOfSamples: number;
};

export class HttpRequestSampler {
  private readonly options: HttpRequestSamplerOptions;

  constructor(
    private readonly logger: Logger,
    private readonly format: ThymianFormat,
    private readonly contentGenerator: ContentGenerator,
    private readonly writer: OutputWriter,
    options: Partial<HttpRequestSamplerOptions> = {}
  ) {
    this.options = {
      numberOfSamples: 10,
      ...options,
    };
  }

  async generateForRequest(
    request: ThymianHttpRequest,
    requestId: string
  ): Promise<void> {
    for (let idx = 0; idx < this.options.numberOfSamples; ++idx) {
      const sample: SampleHttRequest = {
        headers: {},
        pathParameters: {},
        cookies: {},
        queryParameters: {},
      };

      for await (const key of [
        'headers',
        'pathParameters',
        'cookies',
        'queryParameters',
      ] as const) {
        for await (const [name, parameter] of Object.entries(
          request[key] ?? {}
        )) {
          sample[key][name] =
            parameter.schema.examples?.[idx] ??
            (await this.generateParameter(parameter));
        }
      }

      if (request.body) {
        sample.body =
          request.body.examples?.[idx] ??
          (await this.contentGenerator.generate(
            request.mediaType,
            request.body
          ));
      }

      await this.writer.write(sample, requestId, request);
    }
  }

  generateParameter(parameter: Parameter): Promise<unknown> {
    return this.contentGenerator.generate('application/json', parameter.schema);
  }

  async generate(): Promise<void> {
    const requestIds = this.format.graph.filterNodes((_, node) =>
      isNodeType(node, 'http-request')
    );

    for await (const id of requestIds) {
      const req = this.format.getNode<ThymianHttpRequest>(id);

      if (!req) {
        continue;
      }

      await this.generateForRequest(req, id);
    }
  }
}
