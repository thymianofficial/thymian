import type { ThymianHttpRequest, ThymianHttpResponse } from '@thymian/core';

import type { CommonHttpRequest, CommonHttpResponse } from '../common-types.js';

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
