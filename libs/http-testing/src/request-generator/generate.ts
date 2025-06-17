import { ThymianFormat, type ThymianHttpRequest } from '@thymian/core';

import type { HttpRequestTemplate } from '../http-request-template.js';
import type { ThymianHttpTransaction } from '../http-test-case.js';
import {
  type GenerateContent,
  type GenerateParameter,
  RequestGenerator,
} from './request-generator.js';

export function generateRequestForTransactions(
  format: ThymianFormat,
  transaction: ThymianHttpTransaction,
  generateContent: GenerateContent,
  generateParameter: GenerateParameter
): Promise<HttpRequestTemplate> {
  return new RequestGenerator(
    format,
    transaction,
    generateContent,
    generateParameter
  ).generate();
}

export function generateRequest(
  format: ThymianFormat,
  reqId: string,
  generateContent: GenerateContent,
  generateParameter: GenerateParameter
): Promise<HttpRequestTemplate> {
  const thymianReq = format.getNode<ThymianHttpRequest>(reqId);

  if (typeof thymianReq === 'undefined') {
    throw new Error(`Cannot generate request for id ${reqId}`);
  }

  return new RequestGenerator(
    format,
    { thymianReqId: reqId, thymianReq },
    generateContent,
    generateParameter
  ).generate();
}
