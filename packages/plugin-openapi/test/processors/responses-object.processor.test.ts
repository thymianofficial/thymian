import type { OpenAPIV3_1 } from 'openapi-types';
import { describe, expect, it } from 'vitest';

import { processResponsesObject } from '../../src/processors/responses-object.processor.js';
import type { Parameters } from '../../src/processors/utils.js';

const document: OpenAPIV3_1.Document = {
  openapi: '3.1.1',
  info: {
    title: 'test',
    version: '1.0.0',
  },
  paths: {},
};

const parameters: Parameters = {
  headers: {},
  cookies: {},
  pathParameters: {},
  queryParameters: {},
};

const okResponse: OpenAPIV3_1.ResponseObject = { description: 'ok' };

function statusCodesOf(
  responsesObject: OpenAPIV3_1.ResponsesObject | undefined,
): number[] {
  return processResponsesObject(responsesObject, parameters, document)
    .flatMap(({ responses }) => responses)
    .map(({ statusCode }) => statusCode);
}

describe('processResponsesObject', () => {
  it('should return no responses for an undefined Responses Object', () => {
    expect(statusCodesOf(undefined)).toStrictEqual([]);
  });

  it('should process a plain status code', () => {
    expect(statusCodesOf({ '200': okResponse })).toStrictEqual([200]);
  });

  it('should ignore the default key', () => {
    expect(statusCodesOf({ default: okResponse })).toStrictEqual([]);
  });

  it('should expand an uppercase status code range', () => {
    const statusCodes = statusCodesOf({ '2XX': okResponse });

    expect(statusCodes.length).toBeGreaterThan(1);
    expect(statusCodes).toContain(200);
    expect(statusCodes).toContain(204);
    expect(
      statusCodes.every(
        (code) => Number.isInteger(code) && code >= 200 && code <= 299,
      ),
    ).toBe(true);
  });

  it('should skip specification extension keys instead of coercing them to NaN', () => {
    const statusCodes = statusCodesOf({
      '200': okResponse,
      'x-internal-note': 'reviewed by the API guild',
    } as unknown as OpenAPIV3_1.ResponsesObject);

    expect(statusCodes).toStrictEqual([200]);
    expect(statusCodes.some((code) => Number.isNaN(code))).toBe(false);
  });

  it('should skip an object valued specification extension without resolving it as a response', () => {
    const statusCodes = statusCodesOf({
      '200': okResponse,
      'x-linked-response': { $ref: '#/components/responses/DoesNotExist' },
    });

    expect(statusCodes).toStrictEqual([200]);
  });

  it('should reject a non-integer status code', () => {
    expect(() => statusCodesOf({ '200.5': okResponse })).toThrowError(
      /Invalid status code/,
    );
  });

  it('should reject a key that is neither a status code, a range nor an extension', () => {
    expect(() => statusCodesOf({ ok: okResponse })).toThrowError(
      /Invalid status code/,
    );
  });

  it('should reject a lowercase status code range and point at the uppercase form', () => {
    expect(() => statusCodesOf({ '2xx': okResponse })).toThrowError(
      /Status code ranges must be uppercase, use '2XX' instead\./,
    );
  });

  it('should reject an uppercase-prefixed pseudo extension key', () => {
    expect(() => statusCodesOf({ 'X-Internal-Note': okResponse })).toThrowError(
      /Invalid status code/,
    );
  });
});
