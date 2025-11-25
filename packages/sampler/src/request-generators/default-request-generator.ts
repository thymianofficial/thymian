import { AbstractRequestGenerator } from './abstract-request-generator.js';

export class DefaultRequestGenerator extends AbstractRequestGenerator {
  override matches(): boolean {
    return false;
  }
}
