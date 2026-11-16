import { describe, expect, it } from 'vitest';

import type { CapturedHttpRequest } from '../src/rules/traffic.js';
import { isHeaderCaptured } from '../src/utils.js';

function request(
  headers: CapturedHttpRequest['data']['headers'],
  meta: CapturedHttpRequest['meta'] = {},
): CapturedHttpRequest {
  return {
    data: { origin: 'https://example.com', path: '/', method: 'get', headers },
    meta,
  };
}

describe('isHeaderCaptured', () => {
  it('answers true for a message without captureGaps', () => {
    expect(isHeaderCaptured(request({}), 'accept')).toBe(true);
  });

  it('answers true for a message with an empty captureGaps list', () => {
    expect(isHeaderCaptured(request({}, { captureGaps: [] }), 'accept')).toBe(
      true,
    );
  });

  it('answers false for every name when headers were not captured', () => {
    const message = request(
      {},
      {
        captureGaps: [{ kind: 'headers-not-captured' }],
      },
    );

    expect(isHeaderCaptured(message, 'accept')).toBe(false);
    expect(isHeaderCaptured(message, 'x-custom')).toBe(false);
  });

  it('lets the marker win over headers the message also carries', () => {
    const message = request(
      { accept: 'text/html' },
      { captureGaps: [{ kind: 'headers-not-captured' }] },
    );

    expect(isHeaderCaptured(message, 'accept')).toBe(false);
  });
});
