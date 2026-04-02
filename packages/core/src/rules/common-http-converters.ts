import type {
  ThymianHttpRequest,
  ThymianHttpResponse,
} from '../format/index.js';
import type { HttpRequest, HttpResponse } from '../http.js';
import { getHeader } from '../utils.js';
import type { CommonHttpRequest, CommonHttpResponse } from './contexts.js';

export function thymianToCommonHttpRequest(
  node: ThymianHttpRequest,
  _id: string,
): CommonHttpRequest {
  void _id;

  return {
    origin: `${node.protocol}://${node.host}:${node.port}`,
    path: node.path,
    method: node.method,
    headers: Object.keys(node.headers),
    queryParameters: Object.keys(node.queryParameters),
    cookies: Object.keys(node.cookies),
    mediaType: node.mediaType,
    body: node.bodyRequired ?? false,
  };
}

export function thymianToCommonHttpResponse(
  node: ThymianHttpResponse,
  _id: string,
): CommonHttpResponse {
  void _id;

  return {
    body: !!node.schema,
    headers: Object.keys(node.headers),
    mediaType: node.mediaType,
    statusCode: node.statusCode,
    trailers: [],
  };
}

function extractMediaType(req: HttpRequest): string {
  if (!req.headers) {
    return '';
  }

  const ct = getHeader(req.headers, 'content-type');

  if (Array.isArray(ct)) {
    throw new Error('Content-type is a single valued field.');
  }

  return ct ?? '';
}

export function httpRequestToCommonHttpRequest(
  request: HttpRequest,
  _id?: string,
): CommonHttpRequest {
  void _id;

  return {
    origin: request.origin,
    path: request.path,
    method: request.method,
    headers: Object.keys(request.headers ?? {}),
    queryParameters: Array.from(
      new URLSearchParams(request.path.split('?')[1] ?? '').keys(),
    ),
    cookies: [],
    mediaType: extractMediaType(request),
    body: !!request.body,
  };
}

export function httpResponseToCommonHttpResponse(
  response: HttpResponse,
  _id?: string,
): CommonHttpResponse {
  void _id;

  return {
    body: !!response.body,
    headers: Object.keys(response.headers),
    mediaType: getHeader(response.headers, 'content-type')?.at(0) ?? '',
    statusCode: response.statusCode,
    trailers: Object.keys(response.trailers),
  };
}
