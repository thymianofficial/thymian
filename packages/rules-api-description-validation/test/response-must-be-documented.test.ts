import {
  type CapturedTransaction,
  type HttpResponse,
  NoopLogger,
  type RuleFnResult,
  runRules,
  ThymianFormat,
} from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import {
  AnalyticsApiContext,
  SqliteHttpTransactionRepository,
} from '@thymian/plugin-http-analyzer';
import { describe, expect, it } from 'vitest';

import rule from '../src/rules/response-must-be-documented.rule.js';

const NAME = 'thymian/response-must-be-documented';

/**
 * `POST /v2/clock` documents 200 and 404 concretely; `GET /v2/clock`
 * documents 200 and `default`; `DELETE /v2/clock` documents no responses.
 */
function specification(): { format: ThymianFormat; ids: string[] } {
  const format = new ThymianFormat();
  const operations: {
    method: string;
    responses: { statusCode: number | 'default'; mediaType: string }[];
  }[] = [
    {
      method: 'POST',
      responses: [
        { statusCode: 404, mediaType: 'application/problem+json' },
        { statusCode: 200, mediaType: 'application/json' },
        { statusCode: 200, mediaType: 'application/xml' },
      ],
    },
    {
      method: 'GET',
      responses: [
        { statusCode: 200, mediaType: 'application/json' },
        { statusCode: 'default', mediaType: 'application/problem+json' },
      ],
    },
  ];
  const ids: string[] = [];

  for (const { method, responses } of operations) {
    for (const response of responses) {
      const [requestId] = format.addHttpTransaction(
        createHttpRequest({
          method,
          path: '/v2/clock',
          host: 'api.example.com',
        }),
        createHttpResponse(response),
        'test-source',
      );
      ids.push(requestId);
    }
  }

  ids.push(
    format.addRequest(
      createHttpRequest({
        method: 'DELETE',
        path: '/v2/clock',
        host: 'api.example.com',
      }),
    ),
  );

  return { format, ids: [...new Set(ids)] };
}

function recorded(
  method: string,
  statusCode: number,
  contentType: string,
  path = '/v2/clock',
): CapturedTransaction {
  const response: HttpResponse = {
    statusCode,
    headers: contentType ? { 'content-type': contentType } : {},
    trailers: {},
    duration: 0,
  };

  return {
    request: {
      data: { origin: 'https://api.example.com', path, method, headers: {} },
      meta: {},
    },
    response: { data: response, meta: {} },
  };
}

async function analyze(
  format: ThymianFormat,
  transactions: CapturedTransaction[],
): Promise<RuleFnResult[]> {
  const logger = new NoopLogger();
  const repository = new SqliteHttpTransactionRepository(':memory:', logger);
  await repository.init();

  for (const transaction of transactions) {
    repository.insertHttpTransaction(transaction);
  }

  try {
    const results = await runRules(
      logger,
      [rule],
      format,
      {},
      {
        errorName: 'AnalyticsRuleError',
        mode: 'analytics',
        getRuleFn: (r) => r.analyzeRule,
        createContext: () =>
          new AnalyticsApiContext({ repository, logger, format }),
      },
    );

    return results[NAME]?.ruleFnResult ?? [];
  } finally {
    repository.close();
  }
}

describe(NAME, () => {
  it('is an analytics-only error rule', () => {
    expect(rule.meta).toMatchObject({
      name: NAME,
      severity: 'error',
      type: ['analytics'],
    });
  });

  it('reports an undocumented status, listing the documented statuses', async () => {
    const { format, ids } = specification();

    const results = await analyze(format, [
      recorded('POST', 503, 'application/problem+json'),
    ]);

    expect(results).toEqual([
      {
        location: { elementType: 'node', elementId: ids[0] },
        violation: {
          message:
            'Response status 503 is not documented for POST /v2/clock. Documented: 200, 404.',
        },
        findings: [],
      },
    ]);
  });

  it('reports an undocumented media type on a concrete status, listing its documented media types', async () => {
    const { format, ids } = specification();

    const results = await analyze(format, [recorded('POST', 200, 'text/html')]);

    expect(results).toEqual([
      {
        location: { elementType: 'node', elementId: ids[0] },
        violation: {
          message:
            'Response media type text/html is not documented for status 200 of POST /v2/clock. Documented: application/json, application/xml.',
        },
        findings: [],
      },
    ]);
  });

  it('reports an undocumented media type on default', async () => {
    const { format, ids } = specification();

    const results = await analyze(format, [recorded('GET', 503, 'text/html')]);

    expect(results).toEqual([
      {
        location: { elementType: 'node', elementId: ids[1] },
        violation: {
          message:
            'Response media type text/html is not documented for default of GET /v2/clock. Documented: application/problem+json.',
        },
        findings: [],
      },
    ]);
  });

  it('lists none for an operation documenting no responses', async () => {
    const { format, ids } = specification();

    const results = await analyze(format, [recorded('DELETE', 204, '')]);

    expect(results).toEqual([
      {
        location: { elementType: 'node', elementId: ids[2] },
        violation: {
          message:
            'Response status 204 is not documented for DELETE /v2/clock. Documented: none.',
        },
        findings: [],
      },
    ]);
  });

  it('names a missing content type as (none)', async () => {
    const { format } = specification();

    const results = await analyze(format, [recorded('POST', 200, '')]);

    expect(results.map(({ violation }) => violation?.message)).toEqual([
      'Response media type (none) is not documented for status 200 of POST /v2/clock. Documented: application/json, application/xml.',
    ]);
  });

  it('passes a response a concrete status covers', async () => {
    const { format } = specification();

    const results = await analyze(format, [
      recorded('POST', 404, 'application/problem+json'),
    ]);

    expect(results).toEqual([
      {
        location: expect.objectContaining({ elementType: 'edge' }),
        findings: [],
      },
    ]);
  });

  it('passes a response only default covers', async () => {
    const { format } = specification();

    const results = await analyze(format, [
      recorded('GET', 503, 'application/problem+json'),
    ]);

    expect(results).toEqual([
      {
        location: expect.objectContaining({ elementType: 'edge' }),
        findings: [],
      },
    ]);
  });

  it('skips an unknown operation with the unknown-endpoint message', async () => {
    const { format } = specification();

    const results = await analyze(format, [
      recorded('POST', 503, 'text/html', '/v2/unknown'),
    ]);

    expect(results).toEqual([
      {
        location: expect.any(String),
        findings: [
          {
            title: NAME,
            kind: 'rule-skip',
            message:
              'No matching endpoint found in corresponding API description document.',
          },
        ],
      },
    ]);
  });

  it('fires once per recorded transaction', async () => {
    const { format } = specification();

    const results = await analyze(format, [
      recorded('POST', 503, 'text/html'),
      recorded('POST', 418, 'text/html'),
    ]);

    expect(results.map(({ violation }) => violation?.message)).toEqual([
      'Response status 503 is not documented for POST /v2/clock. Documented: 200, 404.',
      'Response status 418 is not documented for POST /v2/clock. Documented: 200, 404.',
    ]);
  });
});
