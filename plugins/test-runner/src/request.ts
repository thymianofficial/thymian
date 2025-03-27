import type { Request, Response } from './types.js';
import { request } from 'undici';
import { encodeResponseBody } from './encode.js';

export async function performRequest(req: Request): Promise<Response> {
  const response = await request(req.url, {
    method: req.method,
    headers: req.headers,
    body: req.body,
    bodyTimeout: req.timeout,
    headersTimeout: req.timeout,
  });

  const contentType = extractContentType(req.headers);

  const encoded = encodeResponseBody(await response.body.bytes(), contentType);

  return {
    body: encoded.str,
    bodyEncoding: encoded.encoding,
    headers: response.headers,
    statusCode: response.statusCode,
    trailers: response.trailers,
  };
}

export function extractContentType(
  headers?: Record<string, string | string[]>
): string {
  if (!headers || !headers['content-type']) {
    return 'application/octet-stream';
  }

  if (Array.isArray(headers['content-type'])) {
    throw new Error('"Content-Type" is defined as singleton header field.');
  }

  return headers['content-type'];
}
