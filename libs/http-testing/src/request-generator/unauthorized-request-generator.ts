import type { HttpRequestTemplate } from '../http-request-template.js';
import { BaseRequestGenerator } from './base-request-generator.js';

export class UnauthorizedRequestGenerator extends BaseRequestGenerator {
  override matches(): boolean {
    return this.transaction.thymianRes.statusCode === 401;
  }

  protected override async authorizeRequest(
    request: HttpRequestTemplate
  ): Promise<HttpRequestTemplate> {
    return request;
  }
}
