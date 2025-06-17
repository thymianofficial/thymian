import { request } from 'undici';
import type { HttpMethod, HttpRequest, HttpResponse } from './types.js';
import { decodeBody } from './decode-body.js';

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

export async function dispatchHttpRequest(
  httpRequest: HttpRequest
): Promise<HttpResponse> {
  if (!isValidHttpMethod(httpRequest.method)) {
    throw new Error('Invalid HTTP method.');
  }

  const start = performance.now();

  const response = await request(httpRequest.url, {
    method: httpRequest.method,
    headers: httpRequest.headers,
    body: decodeBody(httpRequest.body, httpRequest.bodyEncoding),
    bodyTimeout: httpRequest.timeout,
    headersTimeout: httpRequest.timeout,
  });

  return {
    body: await response.body.text(),
    bodyEncoding: '',
    duration: performance.now() - start,
    headers: response.headers,
    statusCode: response.statusCode,
    trailers: response.trailers,
  };
}
