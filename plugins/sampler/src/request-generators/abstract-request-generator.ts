import {
  type Parameter,
  type ThymianFormat,
  type ThymianHttpTransaction,
} from '@thymian/core';

import type { ContentGenerator } from '../content-generator/content-generator.js';
import type { HttpRequestSample } from '../http-request-sample.js';
import type { OutputWriter } from '../output-writer/output-writer.js';

export abstract class AbstractRequestGenerator {
  constructor(
    protected readonly format: ThymianFormat,
    protected readonly transaction: ThymianHttpTransaction,
    protected readonly contentGenerator: ContentGenerator,
    protected readonly writer: OutputWriter,
  ) {}

  abstract matches(): boolean;

  async generate(): Promise<void> {
    const requestSample: HttpRequestSample = {
      meta: {
        source: this.transaction,
      },
      request: {
        origin: this.getOrigin(),
        path: this.getPath(),
        pathParameters: await this.generatePathParameters(),
        method: this.getHttpMethod(),
        authorize: this.authorize(),
        query: await this.generateQueryParameters(),
        headers: await this.generateHeaders(),
        cookies: await this.generateCookies(),
      },
    };

    if (this.shouldGenerateBody() && this.transaction.thymianReq.body) {
      const result = await this.contentGenerator.generate(
        this.transaction.thymianReq.mediaType,
        this.transaction.thymianReq.body,
      );

      if ('buffer' in result) {
        requestSample.request.bodyEncoding = result.encoding;
        requestSample.meta.bodyPath = await this.writer.writeAssetFor(
          result.buffer,
          result.ext,
          requestSample,
        );
      } else {
        requestSample.request.body = result.content;
      }
    }

    await this.writer.writeSample(requestSample);
  }

  protected shouldGenerateBody(): boolean {
    const { thymianReq } = this.transaction;
    const methodsWithBody = ['POST', 'PUT', 'PATCH'];

    return (
      !!thymianReq.body &&
      (thymianReq.bodyRequired ||
        methodsWithBody.some((m) => thymianReq.method.toUpperCase() === m))
    );
  }

  protected shouldWriteBodyToAsset(): boolean {
    return [
      /^image\//,
      /^video\//,
      /^audio\//,
      /^application\/pdf$/,
      /^text\/csv$/,
    ].some((t) => t.test(this.transaction.thymianReq.mediaType));
  }

  protected async generateParameters(
    parameters: Record<string, Parameter>,
  ): Promise<Record<string, unknown>> {
    const generated = {} as Record<string, unknown>;

    for (const [name, parameter] of Object.entries(parameters)) {
      const result = await this.contentGenerator.generate(
        parameter.contentType ?? 'application/json',
        parameter.schema,
      );

      if ('buffer' in result) {
        throw new Error('Not supported.');
      }

      generated[name] = result.content;
    }

    return generated;
  }

  protected async generateHeaders(): Promise<Record<string, unknown>> {
    const headers = await this.generateParameters(
      this.transaction.thymianReq.headers,
    );

    const { mediaType } = this.transaction.thymianReq;

    if (this.transaction.thymianReq.mediaType && this.shouldGenerateBody()) {
      headers['content-type'] = mediaType;
    }

    if (this.transaction.thymianRes?.mediaType) {
      headers['accept'] = this.transaction.thymianRes.mediaType;
    }

    return headers;
  }

  protected generateQueryParameters(): Promise<Record<string, unknown>> {
    return this.generateParameters(this.transaction.thymianReq.queryParameters);
  }

  protected generatePathParameters(): Promise<Record<string, unknown>> {
    return this.generateParameters(this.transaction.thymianReq.pathParameters);
  }

  protected generateCookies(): Promise<Record<string, unknown>> {
    return this.generateParameters(this.transaction.thymianReq.cookies);
  }

  protected authorize(): boolean {
    return this.format.requestIsSecured(this.transaction.thymianReqId);
  }

  protected getHttpMethod(): string {
    return this.transaction.thymianReq.method;
  }

  protected getPath(): string {
    return this.transaction.thymianReq.path;
  }

  protected getOrigin(): string {
    return `${this.transaction.thymianReq.protocol}://${this.transaction.thymianReq.host}:${this.transaction.thymianReq.port}`;
  }
}
