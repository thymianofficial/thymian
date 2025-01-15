import type { Logger } from '@thymian/core';
import { type Client } from 'undici';
import type { Request, Response } from './types.js';
import { encodeResponseBody } from './encode.js';

export class Runner {
  constructor(
    private readonly logger: Logger,
    private readonly client: Client
  ) {}

  async request(req: Request): Promise<Response> {
    const start = performance.now();

    const response = await this.client.request<{ name: string }>({
      method: req.method,
      headers: req.headers,
      body: req.body,
      path: req.path,
      bodyTimeout: req.timeout,
      headersTimeout: req.timeout,
    });

    const end = performance.now();

    const contentType = this.extractContentType(req.headers);

    const encoded = encodeResponseBody(
      await response.body.bytes(),
      contentType
    );

    return {
      body: encoded.str,
      bodyEncoding: encoded.encoding,
      timing: { duration: end - start },
      headers: response.headers,
      statusCode: response.statusCode,
      trailers: response.trailers,
    };
  }

  private extractContentType(
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
}
