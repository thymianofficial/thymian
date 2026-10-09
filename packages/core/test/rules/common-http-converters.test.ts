import { describe, expect, it } from 'vitest';

import type { ThymianHttpResponse } from '../../src/format/index.js';
import type { HttpResponse } from '../../src/http.js';
import { NoopLogger } from '../../src/logger/noop.logger.js';
import {
  httpResponseToCommonHttpResponse,
  thymianToCommonHttpResponse,
} from '../../src/rules/common-http-converters.js';

class SpyLogger extends NoopLogger {
  readonly warnings: string[] = [];

  override warn(message?: string): void {
    this.warnings.push(String(message));
  }
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
      const logger = new SpyLogger();

      const common = httpResponseToCommonHttpResponse(
        response({ 'content-type': ['text/html', 'application/json'] }),
        'res-1',
        logger,
      );

      expect(common.mediaType).toBe('text/html');
      expect(logger.warnings).toHaveLength(1);
      expect(logger.warnings[0]).toContain('res-1');
      expect(logger.warnings[0]).toContain('200');
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
      const logger = new SpyLogger();

      const common = httpResponseToCommonHttpResponse(
        response(headers),
        undefined,
        logger,
      );

      expect(common.mediaType).toBe('');
      expect(logger.warnings).toEqual([]);
    });
  });
});

describe('thymianToCommonHttpResponse', () => {
  it.each([
    ['Application/JSON', 'application/json'],
    ['application/json; charset=utf-8', 'application/json'],
    ['application/json', 'application/json'],
    ['*/*', '*/*'],
    ['', ''],
  ])('normalises the spec media type %j to %j', (mediaType, expected) => {
    const common = thymianToCommonHttpResponse(
      {
        mediaType,
        statusCode: 200,
        headers: {},
      } as unknown as ThymianHttpResponse,
      'id',
    );

    expect(common.mediaType).toBe(expected);
  });
});
