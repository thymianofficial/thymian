import {
  type ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';

import type { HttpRequestTemplate } from '../rxjs/http-request-template.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { generate200Request } from './ok.request.js';

export type GenerateContext = {
  reqId: string;
  request: ThymianHttpRequest;
  resId: string;
  response: ThymianHttpResponse;
  format: ThymianFormat;
};

export type RequestGenerator = (ctx: GenerateContext) => HttpRequestTemplate;

const generators: Record<number, RequestGenerator> = {
  200: generate200Request,
};

export const generateRequest: RequestGenerator = (ctx) => {
  if (ctx.response.statusCode in generators) {
    return generators[ctx.response.statusCode]!(ctx);
  }

  throw new Error('');
};
