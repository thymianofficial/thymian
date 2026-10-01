import { describe, expect, it, vi } from 'vitest';

import type { HttpResponse } from '../../src/http.js';
import type { Logger } from '../../src/logger/logger.js';
import { httpResponseToCommonHttpResponse } from '../../src/rules/common-http-converters.js';

function mockLogger(): Logger {
  return { warn: vi.fn() } as unknown as Logger;
}

function response(headers: HttpResponse['headers']): HttpResponse {
  return { statusCode: 200, headers, trailers: {}, duration: 0 };
}

describe('httpResponseToCommonHttpResponse', () => {
  describe('mediaType', () => {
    it('is the whole media type for a single-valued Content-Type', () => {
      const common = httpResponseToCommonHttpResponse(
        response({ 'content-type': 'application/json' }),
      );

      expect(common.mediaType).toBe('application/json');
    });

    it('is the bare lowercase type, without parameters', () => {
      const common = httpResponseToCommonHttpResponse(
        response({ 'Content-Type': 'Application/JSON ; charset=UTF-8' }),
      );

      expect(common.mediaType).toBe('application/json');
    });

    it('takes the first value of a duplicated Content-Type and warns once', () => {
      const logger = mockLogger();

      const common = httpResponseToCommonHttpResponse(
        response({ 'content-type': ['text/html', 'application/json'] }),
        undefined,
        logger,
      );

      expect(common.mediaType).toBe('text/html');
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['missing', {}],
      ['empty', { 'content-type': '' }],
      ['whitespace only', { 'content-type': '   ' }],
      ['parameters without a type', { 'content-type': ';charset=utf-8' }],
      ['an empty array', { 'content-type': [] }],
      ['not a type/subtype', { 'content-type': 'foo' }],
      ['an incomplete type/subtype', { 'content-type': 'text/' }],
      ['a comma-separated list', { 'content-type': 'text/html, text/plain' }],
    ])('is empty when the Content-Type is %s', (_name, headers) => {
      const logger = mockLogger();

      const common = httpResponseToCommonHttpResponse(
        response(headers),
        undefined,
        logger,
      );

      expect(common.mediaType).toBe('');
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
