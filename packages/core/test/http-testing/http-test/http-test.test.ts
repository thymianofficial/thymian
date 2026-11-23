import { describe, expect, it } from 'vitest';

import { ThymianFormat } from '../../../src/format/index.js';
import { httpTest } from '../../../src/http-testing/http-test/http-test.js';
import type { HttpTestContext } from '../../../src/http-testing/http-test/http-test-context.js';
import { mapToTestCase } from '../../../src/http-testing/operators/map-to-test-case.operator.js';

function formatWithStatuses(...statuses: (number | 'default')[]) {
  const format = new ThymianFormat();

  for (const statusCode of statuses) {
    format.addHttpTransaction(
      {
        type: 'http-request',
        host: 'api.example.test',
        port: 443,
        protocol: 'https',
        path: '/launches',
        method: 'GET',
        headers: {},
        queryParameters: {},
        cookies: {},
        pathParameters: {},
        mediaType: '',
      },
      {
        type: 'http-response',
        statusCode,
        headers: {},
        mediaType: 'application/json',
      },
      'test-source',
    );
  }

  return format;
}

describe('httpTest case generation', () => {
  it('leaves default transactions out, because they are not test targets', async () => {
    const run = httpTest('generation', (items) => items.pipe(mapToTestCase()));

    const result = await run({
      format: formatWithStatuses(200, 'default', 404),
    } as unknown as HttpTestContext);

    expect(result.cases.map((testCase) => testCase.name)).toStrictEqual([
      'GET /launches -> 200 (application/json)',
      'GET /launches -> 404 (application/json)',
    ]);
  });
});
