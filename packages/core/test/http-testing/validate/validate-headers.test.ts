import { describe, expect, it } from 'vitest';

import { DEFAULT_HEADER_SERIALIZATION_STYLE } from '../../../src/constants.js';
import type { ThymianHttpResponse } from '../../../src/format/nodes/http-response.node.js';
import { validateExistingHeader } from '../../../src/http-testing/validate/validate-headers.js';

function responseWithHeaderSchema(schema: unknown): ThymianHttpResponse {
  return {
    type: 'http-response',
    label: '200 OK',
    mediaType: 'application/json',
    statusCode: 200,
    headers: {
      'x-count': {
        required: true,
        schema: schema as never,
        style: DEFAULT_HEADER_SERIALIZATION_STYLE,
      },
    },
  };
}

describe('validateExistingHeader', () => {
  it('returns assertion-success for a header matching its schema', () => {
    const response = responseWithHeaderSchema({ type: 'string' });

    const results = validateExistingHeader({ 'x-count': '12345' }, response);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      type: 'assertion-success',
      message: 'Valid header x-count.',
    });
  });

  it('emits one assertion-failure per schema error', () => {
    const response = responseWithHeaderSchema({
      type: 'string',
      minLength: 5,
      pattern: '^[0-9]+$',
    });

    const results = validateExistingHeader({ 'x-count': 'ab' }, response);

    const failures = results.filter((r) => r.type === 'assertion-failure');
    expect(failures.length).toBeGreaterThanOrEqual(2);
    expect(
      failures.every((r) => r.message.startsWith('header "x-count"')),
    ).toBe(true);
  });

  it('returns info when the response declares no schema for the header', () => {
    const response: ThymianHttpResponse = {
      type: 'http-response',
      label: '200 OK',
      mediaType: 'application/json',
      statusCode: 200,
      headers: {
        'x-count': {
          required: true,
          schema: undefined as never,
          style: DEFAULT_HEADER_SERIALIZATION_STYLE,
        },
      },
    };

    const results = validateExistingHeader({ 'x-count': '1' }, response);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ type: 'info' });
  });
});
