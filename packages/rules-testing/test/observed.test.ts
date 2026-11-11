import {
  and,
  authorization,
  constant,
  type HttpRequest,
  httpRule,
  method,
  path,
  responseHeader,
  type RuleFnResult,
} from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createParameter,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import {
  type ObservedTransaction,
  runInContext,
  type ValidationContext,
} from '../src/index.js';

type Described = ObservedTransaction['described'];

function described(
  request: Partial<Described['request']> = {},
  response: Partial<Described['response']> = {},
): Pick<Described, 'request' | 'response'> {
  return {
    request: createHttpRequest({
      host: 'api.example.com',
      port: 443,
      protocol: 'https',
      ...request,
    }),
    response: createHttpResponse(response),
  };
}

// Flags every transaction it sees, in both contexts.
const flagsEverything = httpRule('rules-testing/flags-everything')
  .severity('error')
  .type('static', 'test')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();

const violations = (results: RuleFnResult[]) =>
  results.filter((result) => result.violation !== undefined);

describe('an observed list', () => {
  describe('in static', () => {
    it("builds the format from every row's described pair", async () => {
      const results = await runInContext('static', flagsEverything, {
        observed: [
          { described: described({ path: '/a' }) },
          { described: described({ path: '/b' }, { statusCode: 404 }) },
        ],
      });

      expect(violations(results)).toHaveLength(2);
    });

    it('marks a row secured only when it says so', async () => {
      const flagsSecured = httpRule('rules-testing/flags-secured')
        .severity('error')
        .type('static')
        .rule((ctx) =>
          ctx.validateCommonHttpTransactions({
            appliesTo: authorization(),
            violatedWhen: constant(true),
          }),
        )
        .done();

      const results = await runInContext('static', flagsSecured, {
        observed: [
          { described: { ...described({ path: '/a' }), secured: true } },
          { described: described({ path: '/b' }) },
        ],
      });

      expect(violations(results)).toHaveLength(1);
    });
  });

  describe('in test', () => {
    // Records every request sent, by answering with a rule that sees them.
    async function sent(rows: ObservedTransaction[]): Promise<HttpRequest[]> {
      const requests: HttpRequest[] = [];
      const recordsRequests = httpRule('rules-testing/records-requests')
        .severity('error')
        .type('test')
        .rule((ctx) =>
          ctx.validateHttpTransactions(constant(true), (req) => {
            requests.push(req);
            return [];
          }),
        )
        .done();

      await runInContext('test', recordsRequests, { observed: rows });
      return requests;
    }

    it('sends the sampled request when a row pins nothing', async () => {
      const [request] = await sent([
        { described: described({ method: 'GET', path: '/orders' }) },
      ]);

      expect(request).toMatchObject({
        method: 'GET',
        origin: 'https://api.example.com:443',
        path: '/orders',
      });
    });

    it("overrides the sampled request with the row's actual request", async () => {
      const [request] = await sent([
        {
          described: described({ method: 'GET', path: '/orders' }),
          actual: { request: { headers: { 'x-trace': '1' } } },
        },
      ]);

      expect(request).toMatchObject({
        method: 'GET',
        path: '/orders',
        headers: { 'x-trace': '1' },
      });
    });

    it("answers with the row's actual response", async () => {
      const results = await runInContext(
        'test',
        httpRule('rules-testing/flags-deprecation')
          .severity('error')
          .type('test')
          .rule((ctx) =>
            ctx.validateHttpTransactions(
              constant(true),
              responseHeader('deprecation'),
            ),
          )
          .done(),
        {
          observed: [
            {
              described: described({ path: '/a' }),
              actual: { response: { headers: { deprecation: 'true' } } },
            },
            { described: described({ path: '/b' }) },
          ],
        },
      );

      expect(violations(results)).toHaveLength(1);
    });

    it('answers with the described status, no headers, no trailers and a duration of 1', async () => {
      let answered: unknown;
      const recordsResponse = httpRule('rules-testing/records-response')
        .severity('error')
        .type('test')
        .rule((ctx) =>
          ctx.validateHttpTransactions(constant(true), (_req, res) => {
            answered = res;
            return [];
          }),
        )
        .done();

      await runInContext('test', recordsResponse, {
        observed: [{ described: described({}, { statusCode: 201 }) }],
      });

      expect(answered).toEqual({
        statusCode: 201,
        headers: {},
        trailers: {},
        duration: 1,
      });
    });

    it('matches a sampled concrete path to the row that describes its template', async () => {
      const results = await runInContext(
        'test',
        httpRule('rules-testing/flags-deprecation')
          .severity('error')
          .type('test')
          .rule((ctx) =>
            ctx.validateHttpTransactions(
              constant(true),
              responseHeader('deprecation'),
            ),
          )
          .done(),
        {
          observed: [
            {
              described: described({
                path: '/orders/{id}',
                pathParameters: {
                  id: createParameter({
                    schema: { type: 'string', examples: ['42'] },
                  }),
                },
              }),
              actual: { response: { headers: { deprecation: 'true' } } },
            },
          ],
        },
      );

      expect(violations(results)).toHaveLength(1);
    });

    it('rejects a request no row answers, naming its method and path', async () => {
      await expect(
        runInContext('test', flagsEverything, {
          observed: [
            {
              described: described({ method: 'GET', path: '/orders' }),
              actual: { request: { path: '/elsewhere' } },
            },
          ],
        }),
      ).rejects.toThrow(/GET .*\/elsewhere/);
    });

    it('rejects two rows for one Operation, naming it', async () => {
      await expect(
        runInContext('test', flagsEverything, {
          observed: [
            {
              described: described(
                { method: 'POST', path: '/orders' },
                { statusCode: 201 },
              ),
            },
            {
              described: described(
                { method: 'POST', path: '/orders' },
                { statusCode: 400 },
              ),
            },
          ],
        }),
      ).rejects.toThrow(/POST .*\/orders/);
    });
  });

  // A rule scoped to one Operation: both rows carry the header it flags, so a
  // second violation would mean the out-of-scope row was flagged.
  describe.each<Extract<ValidationContext, 'static' | 'test'>>([
    'static',
    'test',
  ])('for a rule scoped to one Operation, in %s', (context) => {
    it('flags the in-scope row and never the out-of-scope one', async () => {
      const scoped = httpRule('rules-testing/scoped')
        .severity('error')
        .type('static', 'test')
        .rule((ctx) =>
          ctx.validateCommonHttpTransactions({
            appliesTo: and(method('GET'), path('/orders')),
            violatedWhen: responseHeader('deprecation'),
          }),
        )
        .done();
      const deprecated = { deprecation: createParameter() };

      const results = await runInContext(context, scoped, {
        observed: [
          {
            described: described(
              { method: 'GET', path: '/orders' },
              { headers: deprecated },
            ),
            actual: { response: { headers: { deprecation: 'true' } } },
          },
          {
            described: described(
              { method: 'GET', path: '/customers' },
              { headers: deprecated },
            ),
            actual: { response: { headers: { deprecation: 'true' } } },
          },
        ],
      });

      expect(violations(results)).toHaveLength(1);
    });
  });
});
