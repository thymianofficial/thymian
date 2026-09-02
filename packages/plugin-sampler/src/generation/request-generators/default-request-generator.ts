import type {
  Parameter,
  ThymianFormat,
  ThymianHttpTransaction,
} from '@thymian/core';

import type {
  ContentSource,
  HttpRequestSample,
} from '../../http-request-sample.js';
import type { ContentSourceGenerator } from '../content-source-generator.js';

export class DefaultRequestGenerator {
  constructor(
    protected readonly format: ThymianFormat,
    protected readonly transaction: ThymianHttpTransaction,
    protected readonly contentGenerator: ContentSourceGenerator,
  ) {}

  matches(): boolean {
    return false;
  }

  async generate(): Promise<HttpRequestSample> {
    const requestSample: HttpRequestSample = {
      origin: this.getOrigin(),
      path: this.getPath(),
      pathParameters: await this.generatePathParameters(),
      method: this.getHttpMethod(),
      authorize: this.authorize(),
      query: await this.generateQueryParameters(),
      headers: await this.generateHeaders(),
      cookies: await this.generateCookies(),
    };

    if (this.shouldGenerateBody() && this.transaction.thymianReq.body) {
      requestSample.body = await this.contentGenerator.generate(
        this.transaction.thymianReq.mediaType,
        this.transaction.thymianReq.body,
      );
    }

    return requestSample;
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

  protected async generateParameters(
    parameters: Record<string, Parameter>,
  ): Promise<Record<string, ContentSource>> {
    const generated: Record<string, ContentSource> = {};

    for (const [name, parameter] of Object.entries(parameters)) {
      generated[name] = await this.contentGenerator.generate(
        parameter.contentType ?? 'application/json',
        parameter.schema,
      );
    }

    return generated;
  }

  protected async generateHeaders(): Promise<Record<string, ContentSource>> {
    const headers = await this.generateParameters(
      this.transaction.thymianReq.headers,
    );

    const { mediaType } = this.transaction.thymianReq;

    if (this.transaction.thymianReq.mediaType && this.shouldGenerateBody()) {
      headers['content-type'] = {
        $content: mediaType,
      };
    }

    if (this.transaction.thymianRes?.mediaType) {
      headers['accept'] = {
        $content: this.transaction.thymianRes.mediaType,
      };
    }

    return headers;
  }

  protected generateQueryParameters(): Promise<Record<string, ContentSource>> {
    return this.generateParameters(this.transaction.thymianReq.queryParameters);
  }

  protected generatePathParameters(): Promise<Record<string, ContentSource>> {
    return this.generateParameters(this.transaction.thymianReq.pathParameters);
  }

  protected generateCookies(): Promise<Record<string, ContentSource>> {
    return this.generateParameters(this.transaction.thymianReq.cookies);
  }

  /**
   * The spec-derived default for the `authorize` flag: does this request declare
   * a security requirement?
   *
   * A transaction the format does not hold is treated as unsecured. That case is
   * reachable — a transaction can arrive from outside the loaded format, through
   * a nested seeding call or a sample asked for before any format was published
   * — and `requestIsSecured` raises on an unknown request id rather than
   * answering `false`. `getThymianHttpTransactionById` is the one lookup that
   * answers a miss instead of raising, and an existing transaction edge implies
   * its request node, so it is a precise guard rather than a swallowed error.
   * Unsecured is also the safe default: authorization additionally requires a
   * registered authorize hook.
   */
  protected authorize(): boolean {
    const known = this.format.getThymianHttpTransactionById(
      this.transaction.transactionId,
    );

    return known
      ? this.format.requestIsSecured(this.transaction.thymianReqId)
      : false;
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
