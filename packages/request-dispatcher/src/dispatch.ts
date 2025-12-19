import type { HttpRequest, HttpResponse } from '@thymian/core';
import type PQueue from 'p-queue';
import { request } from 'undici';

import { decodeBody } from './decode-body.js';
import type { HttpMethod } from './types.js';

export function isValidHttpMethod(method: string): method is HttpMethod {
  return [
    'GET',
    'POST',
    'PUT',
    'DELETE',
    'PATCH',
    'OPTIONS',
    'HEAD',
    'CONNECT',
    'TRACE',
  ].includes(method.toUpperCase());
}

export type HttpRequestDispatchOptions = {
  timeout: number;
};

export async function dispatchHttpRequest(
  httpRequest: HttpRequest,
  options: Partial<HttpRequestDispatchOptions> = {},
): Promise<HttpResponse> {
  const opts = {
    timeout: 5000,
    ...options,
  };

  const method = httpRequest.method.toUpperCase();

  if (!isValidHttpMethod(method)) {
    throw new Error('Invalid HTTP method.');
  }

  const start = performance.now();

  const response = await request(
    new URL(httpRequest.path, httpRequest.origin).toString(),
    {
      method,
      headers: httpRequest.headers,
      body: decodeBody(httpRequest.body, httpRequest.bodyEncoding),
      bodyTimeout: opts.timeout,
      headersTimeout: opts.timeout,
    },
  );

  const res: HttpResponse = {
    bodyEncoding: '',
    duration: performance.now() - start,
    headers: response.headers,
    statusCode: response.statusCode,
    trailers: response.trailers,
  };

  const body = await response.body.text();

  if (body) {
    res.body = body;
  }

  return res;
}
