import type { ThymianHttpRequest, ThymianHttpResponse } from '@thymian/core';

import type { CommonHttpRequest, CommonHttpResponse } from '../common-types.js';

export function thymianToCommonHttpRequest(
  node: ThymianHttpRequest,
  id: string,
): CommonHttpRequest {
  return {
    origin: `${node.protocol}://${node.host}:${node.port}`,
    path: node.path,
    method: node.method,
    headers: Object.keys(node.headers),
    queryParameters: Object.keys(node.queryParameters),
    cookies: Object.keys(node.cookies),
    mediaType: node.mediaType,
    body: node.bodyRequired ?? false,
    location: {
      elementType: 'node',
      elementId: id,
    },
  };
}

export function thymianToCommonHttpResponse(
  node: ThymianHttpResponse,
  id: string,
): CommonHttpResponse {
  return {
    body: !!node.schema,
    headers: Object.keys(node.headers),
    mediaType: node.mediaType,
    statusCode: node.statusCode,
    trailers: [],
    location: {
      elementType: 'node',
      elementId: id,
    },
  };
}
