import type { HttpRequestTemplate } from '../http-request-template.js';

export interface RequestGenerator {
  matches(): boolean;

  generate(): Promise<HttpRequestTemplate>;
}
