import { BaseRequestGenerator } from './base-request-generator.js';

export class RangeRequestGenerator extends BaseRequestGenerator {
  /*
  The specification is intentionally kept open for range units types.
  A logic that extracts the appropriate unit could be implemented here.
  However, since `bytes` is the only official range unit, we simply use it.
   */
  private extractRangeUnit(): string {
    return 'bytes';
  }

  protected override async generateHeaders(): Promise<Record<string, unknown>> {
    const headers = await super.generateHeaders();

    headers['range'] = `${this.extractRangeUnit()}=0-1`;

    return headers;
  }

  override matches(): boolean {
    return this.transaction.thymianRes.statusCode === 206;
  }
}
