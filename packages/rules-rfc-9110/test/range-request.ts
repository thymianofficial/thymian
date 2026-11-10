import type { CapturedTransaction } from '@thymian/core';

/** A recorded GET from a user agent carrying `range`, answered with a 206. */
export function rangeRequest(range: string | string[]): CapturedTransaction {
  return {
    request: {
      data: {
        origin: 'https://example.com',
        path: '/audio.wav',
        method: 'get',
        headers: { range },
      },
      meta: { role: 'user-agent' },
    },
    response: {
      data: {
        statusCode: 206,
        headers: { 'content-range': 'bytes 0-99/100' },
        trailers: {},
        duration: 1,
      },
      meta: { role: 'origin server' },
    },
  };
}
