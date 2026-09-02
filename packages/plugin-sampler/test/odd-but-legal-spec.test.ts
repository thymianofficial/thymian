import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { afterEach, describe, expect, it } from 'vitest';

import { selectorForTransaction } from '../src/selectors/selector.js';
import { TransactionCatalog } from '../src/selectors/transaction-catalog.js';
import { type SamplerHarness, startSampler } from './plugin-harness.js';

/**
 * #9: no legal description may abort catalog construction, type generation or a
 * run. Rendering encodes what it cannot spell rather than rejecting it, so every
 * transaction below stays addressable.
 */
describe('an odd-but-legal description', () => {
  const harnesses: SamplerHarness[] = [];

  afterEach(async () => {
    await Promise.all(harnesses.splice(0).map((h) => h.dispose()));
  });

  const format = createThymianFormatWithTransactions([
    // A quoted-string media-type parameter, parentheses included.
    [
      createHttpRequest({
        method: 'POST',
        path: '/reports',
        mediaType: 'text/plain; format="a(b)"',
      }),
      createHttpResponse({
        statusCode: 200,
        mediaType: 'application/vnd.thymian+json; profile="x) y"',
      }),
    ],
    // A path template with characters a selector would otherwise trip over.
    [
      createHttpRequest({ method: 'GET', path: '/a b/c->d/{id}' }),
      createHttpResponse({ statusCode: 200, mediaType: '' }),
    ],
    // A method outside the token character set.
    [
      createHttpRequest({ method: 'GE T', path: '/odd' }),
      createHttpResponse({ statusCode: 200, mediaType: '' }),
    ],
  ]);

  it('catalogs every transaction, and each selector resolves back to it', () => {
    const catalog = TransactionCatalog.fromThymianFormat(format);

    expect(catalog.size).toBe(3);

    for (const transaction of format.getThymianHttpTransactions()) {
      const selector = selectorForTransaction(transaction);

      expect(catalog.resolve(selector).transactionId).toBe(
        transaction.transactionId,
      );
    }
  });

  it('spells the odd parts the way the grammar can carry them', () => {
    const selectors = TransactionCatalog.fromThymianFormat(format).selectors();

    // Sorted by code unit: "%" (0x25) precedes "T" (0x54).
    expect(selectors).toEqual([
      'GE%20T /odd -> 200',
      'GET /a%20b/c-%3Ed/{id} -> 200',
      'POST /reports (text/plain; format="a(b)") -> 200 (application/vnd.thymian+json; profile="x) y")',
    ]);
  });

  it('loads and serves samples for all of them', async () => {
    const harness = await startSampler();
    harnesses.push(harness);

    await harness.loadFormat(format);

    const samples = await harness.sampleAll(format);

    expect(samples).toHaveLength(3);

    const shown = await harness.show(
      'POST /reports (text/plain; format="a(b)") -> 200 (application/vnd.thymian+json; profile="x) y")',
    );

    expect(shown.request.path).toBe('/reports');
  });
});
