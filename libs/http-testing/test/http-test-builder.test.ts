import { describe, it } from 'vitest';

import { sequence, suite, test } from '../src/http-test-builder.js';

describe('http test builder', () => {
  it('should work', () => {
    const seq = sequence('', (sequence) =>
      sequence
        .context(async () => ({
          test: 10,
        }))
        .step('first', (t) => t.done())
        .step('second', (t) => t.done())
        .expect((transactions) => {})
        .done()
    );

    console.log(seq);

    const httpTest = test('first', (t) =>
      t
        .forTransactions((req) => req.method === 'get')
        .override('protocol', (original) => original)
        .expect({ headers: false })
        .expect(() => {})
        .done());

    console.log(httpTest);
  });
});
