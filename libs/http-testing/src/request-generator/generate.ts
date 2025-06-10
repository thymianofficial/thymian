import { ThymianFormat, type ThymianHttpRequest } from '@thymian/core';

import type { HttpRequestTemplate } from '../http-request-template.js';
import type { ThymianHttpTestTransaction } from '../http-test-case.js';
import { type GenerateContent, RequestGenerator } from './request-generator.js';

export function generateRequestForTransactions(
  format: ThymianFormat,
  transaction: ThymianHttpTestTransaction,
  generateContent: GenerateContent
): Promise<HttpRequestTemplate> {
  return new RequestGenerator(format, transaction, generateContent).generate();
}

export function generateRequest(
  format: ThymianFormat,
  reqId: string,
  generateContent: GenerateContent
): Promise<HttpRequestTemplate> {
  const thymianReq = format.getNode<ThymianHttpRequest>(reqId);

  if (typeof thymianReq === 'undefined') {
    throw new Error(`Cannot generate request for id ${reqId}`);
  }

  return new RequestGenerator(
    format,
    { thymianReqId: reqId, thymianReq },
    generateContent
  ).generate();
}
