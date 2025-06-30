import type { ThymianHttpRequest, ThymianHttpResponse } from '@thymian/core';

import type { CommonHttpRequest, CommonHttpResponse } from './api-context.js';

export function thymianToCommonHttpRequest(
  id: string,
  node: ThymianHttpRequest
): CommonHttpRequest {
  return {
    id,
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
  id: string,
  node: ThymianHttpResponse
): CommonHttpResponse {
  return {
    id,
    body: !!node.schema,
    headers: Object.keys(node.headers),
    mediaType: node.mediaType,
    statusCode: node.statusCode,
    trailers: [],
  };
}
