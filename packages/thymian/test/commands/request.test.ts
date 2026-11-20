import { describe, expect, it } from 'vitest';

import { transactionChoices } from '../../src/commands/request.js';

describe('thymian request', () => {
  it('does not offer a default transaction in the picker', async () => {
    // Imported lazily, as the other command tests load `@thymian/core-testing`.
    const {
      createHttpRequest,
      createHttpResponse,
      createThymianFormatWithTransactions,
    } = await import('@thymian/core-testing');
    const request = createHttpRequest({ method: 'GET', path: '/launches' });
    const format = createThymianFormatWithTransactions([
      [request, createHttpResponse({ statusCode: 200 })],
      [request, createHttpResponse({ statusCode: 'default', mediaType: '' })],
    ]);

    expect([...transactionChoices(format).keys()]).toEqual([
      'GET /launches -> 200 (application/json)',
    ]);
  });
});
