import {
  type Parameter,
  type PartialBy,
  ThymianFormat,
  type ThymianSchema,
} from '@thymian/core';

import type { HttpRequestTemplate } from '../http-request-template.js';
import type { ThymianHttpTransaction } from '../http-test-case.js';

export type GenerateContent = (
  schema: ThymianSchema,
  mediaType?: string,
  context?: { reqId?: string; resId?: string }
) => Promise<{ content: unknown; encoding?: string }>;

export type GenerateParameter = (
  name: string,
  type: 'query' | 'path' | 'header' | 'cookie',
  parameter: Parameter,
  context?: { reqId?: string; resId?: string }
) => Promise<{ content: unknown; encoding?: string }>;

export class RequestGenerator {
  constructor(
    protected readonly format: ThymianFormat,
    protected readonly transaction: PartialBy<
      ThymianHttpTransaction,
      'transactionId' | 'thymianRes' | 'thymianResId'
    >,
    protected readonly generateContent: GenerateContent,
    protected readonly generateParameter: GenerateParameter
  ) {}

  protected shouldGenerateBody(): boolean {
    const { thymianReq } = this.transaction;
    const methodsWithBody = ['POST', 'PUT', 'PATCH'];

    return (
      !!thymianReq.body &&
      (thymianReq.bodyRequired || methodsWithBody.includes(thymianReq.method))
    );
  }

  protected async generateRequestBody(): Promise<{
    content: unknown;
    encoding?: string;
  }> {
    if (this.shouldGenerateBody()) {
      return this.generateContent(
        // in shouldGenerateBody is checked if body is defined
        this.transaction.thymianReq.body as ThymianSchema,
        this.transaction.thymianReq.mediaType,
        {
          reqId: this.transaction.thymianReqId,
          resId: this.transaction.thymianResId,
        }
      );
    } else {
      return { content: undefined };
    }
  }

  protected async generateParameters(
    parameters: Record<string, Parameter>,
    type: 'query' | 'path' | 'header' | 'cookie'
  ): Promise<Record<string, unknown>> {
    const generated = {} as Record<string, unknown>;

    for await (const [name, parameter] of Object.entries(parameters)) {
      const { content } = await this.generateParameter(name, type, parameter);

      generated[name] = content;
    }

    return generated;
  }

  protected async generateHeaders(): Promise<Record<string, unknown>> {
    const headers = await this.generateParameters(
      this.transaction.thymianReq.headers,
      'header'
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

  protected async generateQuery(): Promise<Record<string, unknown>> {
    return this.generateParameters(
      this.transaction.thymianReq.queryParameters,
      'query'
    );
  }

  protected async generatePathParameters(): Promise<Record<string, unknown>> {
    return this.generateParameters(
      this.transaction.thymianReq.pathParameters,
      'path'
    );
  }

  async generate(): Promise<HttpRequestTemplate> {
    const request: HttpRequestTemplate = {
      headers: await this.generateHeaders(),
      method: this.transaction.thymianReq.method,
      origin: `${this.transaction.thymianReq.protocol}://${this.transaction.thymianReq.host}:${this.transaction.thymianReq.port}`,
      path: this.transaction.thymianReq.path,
      pathParameters: await this.generatePathParameters(),
      query: await this.generateQuery(),
      cookies: {},
    };

    const { content, encoding } = await this.generateRequestBody();

    if (content) {
      request.body = content;
    }

    if (encoding) {
      request.bodyEncoding = encoding;
    }

    return request;
  }
}
