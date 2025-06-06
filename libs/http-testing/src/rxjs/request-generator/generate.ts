import { ThymianFormat } from '@thymian/core';

import type { HttpRequestTemplate } from '../http-request-template.js';
import type { ThymianHttpTestTransaction } from '../http-test-case.js';
import { type GenerateContent, RequestGenerator } from './request-generator.js';

export function generateRequest(
  format: ThymianFormat,
  transaction: ThymianHttpTestTransaction,
  generateContent: GenerateContent
): Promise<HttpRequestTemplate> {
  return new RequestGenerator(format, transaction, generateContent).generate();
}
