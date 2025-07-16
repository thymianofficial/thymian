import {
  type Parameter,
  type SecurityScheme,
  type ThymianSchema,
} from '@thymian/core';

import type { HttpRequestTemplate } from '../http-request-template.js';
import type { ThymianHttpTransaction } from '../http-test-case.js';
import type {
  GenerateRequestsOptions,
  HttpTestContext,
} from '../http-test-context.js';
import type { RequestGenerator } from './request-generator.js';

export class BaseRequestGenerator implements RequestGenerator {
  protected readonly options: GenerateRequestsOptions;

  constructor(
    protected readonly transaction: ThymianHttpTransaction,
    protected readonly ctx: HttpTestContext,
    options: Partial<GenerateRequestsOptions> = {}
  ) {
    this.options = {
      authenticate: true,
      validCredentials: true,
      ...options,
    };
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

  protected async generateRequestBody(): Promise<{
    content: unknown;
    encoding?: string;
  }> {
    if (this.shouldGenerateBody()) {
      return this.ctx.generateContent(
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

    for (const [name, parameter] of Object.entries(parameters)) {
      if (!parameter.required) {
        continue;
      }

      const { content } = await this.ctx.generateParameterValue(
        name,
        type,
        parameter
      );

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

  protected async authorizeRequest(
    request: HttpRequestTemplate
  ): Promise<HttpRequestTemplate> {
    if (!this.options.authenticate) {
      return request;
    }

    const schemeNodeId = this.ctx.format.graph.findOutNeighbor(
      this.transaction.thymianReqId,
      (id, node) => node.type === 'security-scheme'
    );

    if (schemeNodeId) {
      const securityScheme =
        // we know that the node with this id exists
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.ctx.format.getNode<SecurityScheme>(schemeNodeId)!;

      // extend the if statement to support more security schemes
      if (securityScheme.scheme === 'basic' && this.ctx.auth?.basic) {
        request.headers['Authorization'] = `Basic ${Buffer.from(
          (this.options.validCredentials
            ? // basic auth is defined
              await this.ctx.auth.basic({
                requestTemplate: request,
                source: { ...this.transaction },
              })
            : ['admin', 'admin']
          ) // How should we get invalid credentials?
            .join(':')
        ).toString('base64')}`;
      }
    }

    return request;
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

    return await this.authorizeRequest(request);
  }

  matches(): boolean {
    return false;
  }
}
