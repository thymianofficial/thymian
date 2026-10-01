import type {
  ThymianHttpRequest,
  ThymianHttpResponse,
} from '../format/index.js';
import type { HttpRequest, HttpResponse } from '../http.js';
import type { Logger } from '../logger/logger.js';
import { getHeader, httpResponseToLabel } from '../utils.js';
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
    mediaType: normalizeMediaType(node.mediaType),
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
    target: request.target,
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

// RFC 9110 §8.3.1: type "/" subtype, each a token (RFC 9110 §5.6.2).
const MEDIA_TYPE = /^[a-z0-9!#$%&'*+.^_`|~-]+\/[a-z0-9!#$%&'*+.^_`|~-]+$/;

/**
 * The bare, lowercased `type/subtype` of a `Content-Type` value, with
 * parameters removed. Empty when the value is not a single `type/subtype`.
 */
export function normalizeMediaType(value: string | undefined): string {
  const mediaType = value?.split(';')[0]?.trim().toLowerCase() ?? '';

  return MEDIA_TYPE.test(mediaType) ? mediaType : '';
}

function getMediaType(
  response: HttpResponse,
  id?: string,
  logger?: Logger,
): string {
  const ct = getHeader(response.headers, 'content-type');

  if (Array.isArray(ct) && ct.length > 1) {
    const label = httpResponseToLabel(response);

    logger?.warn(
      `Content-Type is a single valued field, but ${ct.length} values were received for response ${id ? `${id} (${label})` : `"${label}"`}. Using the first one.`,
    );
  }

  return normalizeMediaType(Array.isArray(ct) ? ct[0] : ct);
}

export function httpResponseToCommonHttpResponse(
  response: HttpResponse,
  _id?: string,
  logger?: Logger,
): CommonHttpResponse {
  void _id;

  return {
    body: !!response.body,
    headers: Object.keys(response.headers),
    mediaType: getMediaType(response, _id, logger),
    statusCode: response.statusCode,
    trailers: Object.keys(response.trailers),
  };
}
