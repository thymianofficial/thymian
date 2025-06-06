import type { HttpResponse } from './http-response.js';
import type { HttpRequestTemplate } from './http-request-template.js';

/*
export type HttpRequestTemplate = {
  origin: string;
  path: string;
  pathParameters: Record<string, unknown>;
  method: string;
  query: Record<string, unknown>;
  bodyEncoding?: string;
  body?: string;
  headers: Record<string, unknown>;
};
 */

export type HttpRequest = {
  origin: string;
  path: string;
  method: string;
  bodyEncoding?: string;
  body?: string;
  headers: Record<string, string>;
};

export type RequestRunner = {
  request: (request: HttpRequest) => Promise<HttpResponse>;

  parallelRequests: (requests: HttpRequest[]) => Promise<HttpResponse[]>;
};

export async function runRequest(
  request: HttpRequestTemplate
): Promise<HttpResponse> {
  return {
    body: '',
    bodyEncoding: '',
    duration: 0,
    headers: {},
    statusCode: 0,
    trailers: {},
  };
}
