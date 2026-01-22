import { DefaultRequestGenerator } from './default-request-generator.js';

export class UnauthorizedRequestGenerator extends DefaultRequestGenerator {
  override matches(): boolean {
    return this.transaction.thymianRes.statusCode === 401;
  }

  protected override authorize(): boolean {
    return false;
  }
}
