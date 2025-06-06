import { RequestGenerator } from './request-generator.js';

export class RangeRequestGenerator extends RequestGenerator {
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

    const rangeUnit = this.extractRangeUnit();

    headers['range'] = `${rangeUnit}=0-1`;

    return headers;
  }
}
