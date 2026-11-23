import {
  authorization,
  constant,
  formatLocation,
  type HttpRequest,
  type HttpResponse,
  httpTransactionToLabel,
  NoopLogger,
  resolveViolationLocation,
  type RuleViolationLocation,
  ThymianFormat,
} from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  describeRuleContextScenarios,
} from '@thymian/core-testing';
import { describe, expect, it, onTestFinished } from 'vitest';

import { AnalyticsApiContext } from '../src/analytics-api-context.js';
import { SqliteHttpTransactionRepository } from '../src/db/sqlite-http-transaction-repository.js';

describeRuleContextScenarios({
  name: 'analyze',
  observes: 'actual pair',
  notApplicable: {
    path: 'the analyzer compares the recorded concrete path in SQL, not the described path template',
    port: 'the analyzer cannot translate port() to SQL',
    origin:
      'the analyzer compares the origin as recorded, without the default port',
    hasResponse: 'the analyzer cannot translate responseWith() to SQL',
  },
  async setup(transactions) {
    const logger = new NoopLogger();
    const repository = new SqliteHttpTransactionRepository(':memory:', logger);
    await repository.init();
    onTestFinished(() => repository.close());

    const format = new ThymianFormat();
    for (const { described, actual } of transactions) {
      repository.insertHttpTransaction({
        request: { data: actual.request, meta: {} },
        response: { data: actual.response, meta: {} },
      });
      const [reqId] = format.addHttpTransaction(
        described.request,
        described.response,
        'test-source',
      );

      if (described.secured) {
        const schemeId = format.addSecurityScheme({
          label: 'basic',
          scheme: 'basic',
          sourceName: 'test-source',
          type: 'security-scheme',
        });
        format.addEdge(reqId, schemeId, {
          label: 'basic',
          type: 'is-secured',
          sourceName: 'test-source',
        });
      }
    }

    return {
      context: new AnalyticsApiContext({ repository, logger, format }),
      locationOf: (index) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const { request, response } = transactions[index]!.actual;
        const label = httpTransactionToLabel(request, response);
        // Every form anchors a recorded pair to the described transaction it
        // matches, or to the operation when only the response is
        // undocumented; otherwise the label locates it.
        const resolution = format.resolveTransaction(request, response);

        if (resolution.kind === 'matched') {
          return expect.objectContaining({
            elementType: 'edge',
            elementId: resolution.transactionId,
            label,
          });
        }

        return resolution.kind === 'undocumented-response'
          ? { elementType: 'node', elementId: resolution.requestId }
          : label;
      },
    };
  },
});

describe('analyze: staged matching of a recorded pair', () => {
  const recordedRequest: HttpRequest = {
    origin: 'https://api.example.com',
    path: '/v2/clock',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  };

  function recordedResponse(
    statusCode: number,
    contentType = 'application/json',
  ): HttpResponse {
    return {
      statusCode,
      headers: { 'content-type': contentType },
      trailers: {},
      duration: 0,
    };
  }

  async function analyze(
    response: HttpResponse,
    described: { statusCode: number | 'default'; mediaType?: string }[],
    { secured = false, request = recordedRequest } = {},
  ) {
    const logger = new NoopLogger();
    const repository = new SqliteHttpTransactionRepository(':memory:', logger);
    await repository.init();
    onTestFinished(() => repository.close());
    repository.insertHttpTransaction({
      request: { data: request, meta: {} },
      response: { data: response, meta: {} },
    });

    const format = new ThymianFormat();
    let requestId = '';
    for (const { statusCode, mediaType = 'application/json' } of described) {
      [requestId] = format.addHttpTransaction(
        createHttpRequest({
          method: 'POST',
          path: '/v2/clock',
          host: 'api.example.com',
          mediaType: 'application/json',
        }),
        createHttpResponse({ statusCode, mediaType }),
        'test-source',
      );
    }

    if (secured) {
      const schemeId = format.addSecurityScheme({
        label: 'basic',
        scheme: 'basic',
        sourceName: 'test-source',
        type: 'security-scheme',
      });
      format.addEdge(requestId, schemeId, {
        label: 'basic',
        type: 'is-secured',
        sourceName: 'test-source',
      });
    }

    const context = new AnalyticsApiContext({ repository, logger, format });
    const locations: RuleViolationLocation[] = [];
    context.validateHttpTransactions({
      appliesTo: constant(true),
      violatedWhen: (_req, _res, location) => {
        locations.push(location);
        return [];
      },
    });

    return { context, format, requestId, locations };
  }

  it('locates an undocumented status at the matched request node', async () => {
    const { requestId, locations } = await analyze(recordedResponse(418), [
      { statusCode: 200 },
    ]);

    expect(locations).toEqual([{ elementType: 'node', elementId: requestId }]);
  });

  it('locates an undocumented response media type at the matched request node', async () => {
    const { requestId, locations } = await analyze(
      recordedResponse(200, 'text/html'),
      [{ statusCode: 200 }],
    );

    expect(locations).toEqual([{ elementType: 'node', elementId: requestId }]);
  });

  it('locates a response only default covers at the default transaction', async () => {
    const { format, locations } = await analyze(recordedResponse(503), [
      { statusCode: 200 },
      { statusCode: 'default' },
    ]);
    const [defaultTransaction] = format
      .getThymianHttpTransactions()
      .filter(({ thymianRes }) => thymianRes.statusCode === 'default');

    expect(locations).toEqual([
      expect.objectContaining({
        elementType: 'edge',
        elementId: defaultTransaction?.transactionId,
      }),
    ]);
  });

  it('keeps the label location for an unknown operation', async () => {
    const request = { ...recordedRequest, path: '/v2/unknown' };
    const response = recordedResponse(200);
    const { locations } = await analyze(response, [{ statusCode: 200 }], {
      request,
    });

    expect(locations).toEqual([httpTransactionToLabel(request, response)]);
  });

  it('reports an undocumented response under its operation selector', async () => {
    const { format, locations } = await analyze(recordedResponse(418), [
      { statusCode: 200 },
    ]);
    const { heading, location } = resolveViolationLocation(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      locations[0]!,
      format,
      'some-rule',
    );

    expect(heading).toBe('POST /v2/clock (application/json)');
    expect(formatLocation(location, format)).toBe(
      'POST /v2/clock (application/json)',
    );
  });

  it('answers authorization() from the operation when only the response is undocumented', async () => {
    const { context } = await analyze(
      recordedResponse(418),
      [{ statusCode: 200 }],
      { secured: true },
    );

    expect(
      context.validateHttpTransactions(authorization(), constant(true)),
    ).toHaveLength(1);
  });
});
