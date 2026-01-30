import {
  getHeader,
  type HttpRequest,
  httpRequestToLabel,
  type HttpResponse,
  httpResponseToLabel,
} from '@thymian/core';

import type { CommonHttpRequest, CommonHttpResponse } from '../common-types.js';

export function extractMediaType(req: HttpRequest): string {
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
  id?: string,
): CommonHttpRequest {
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
    location: id
      ? { elementId: id, elementType: 'node' }
      : httpRequestToLabel(request),
  };
}

export function httpResponseToCommonHttpResponse(
  response: HttpResponse,
  id?: string,
): CommonHttpResponse {
  return {
    body: !!response.body,
    headers: Object.keys(response.headers),
    mediaType: getHeader(response.headers, 'content-type')?.at(0) ?? '',
    statusCode: response.statusCode,
    trailers: Object.keys(response.trailers),
    location: id
      ? { elementId: id, elementType: 'node' }
      : httpResponseToLabel(response),
  };
}
