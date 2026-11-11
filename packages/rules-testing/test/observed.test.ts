import {
  and,
  authorization,
  type CapturedTransaction,
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

// Flags every response that carries a `Deprecation` header, in test.
const flagsDeprecation = httpRule('rules-testing/flags-deprecation')
  .severity('error')
  .type('test')
  .rule((ctx) =>
    ctx.validateHttpTransactions(constant(true), responseHeader('deprecation')),
  )
  .done();

// Flags every recorded response that carries a `Deprecation` header.
const flagsDeprecationRecorded = httpRule(
  'rules-testing/flags-deprecation-recorded',
)
  .severity('error')
  .type('analytics')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions({
      appliesTo: constant(true),
      violatedWhen: responseHeader('deprecation'),
    }),
  )
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
      const results = await runInContext('test', flagsDeprecation, {
        observed: [
          {
            described: described({ path: '/a' }),
            actual: { response: { headers: { deprecation: 'true' } } },
          },
          { described: described({ path: '/b' }) },
        ],
      });

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
      const rows: ObservedTransaction[] = [
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
      ];

      const results = await runInContext('test', flagsDeprecation, {
        observed: rows,
      });

      expect(violations(results)).toHaveLength(1);
      expect(await sent(rows)).toEqual([
        expect.objectContaining({ path: '/orders/42' }),
      ]);
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

  describe('in analytics', () => {
    // Records every transaction the analyzer holds, as it was recorded.
    async function recorded(
      rows: ObservedTransaction[],
    ): Promise<CapturedTransaction[]> {
      const transactions: CapturedTransaction[] = [];
      const recordsTraffic = httpRule('rules-testing/records-traffic')
        .severity('error')
        .type('analytics')
        .overrideAnalyticsRule((ctx) =>
          ctx.validateCapturedHttpTransactions(
            constant(true),
            (transaction) => {
              transactions.push(transaction);
              return [];
            },
          ),
        )
        .done();

      await runInContext('analytics', recordsTraffic, { observed: rows });
      return transactions;
    }

    it("records one transaction per row, built from the row's actual part", async () => {
      const results = await runInContext(
        'analytics',
        flagsDeprecationRecorded,
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

    it('records the described status, no headers, no trailers and a duration of 1', async () => {
      const [transaction] = await recorded([
        { described: described({}, { statusCode: 201 }) },
      ]);

      expect(transaction?.response.data).toMatchObject({
        statusCode: 201,
        headers: {},
        trailers: {},
        duration: 1,
      });
    });

    it("overrides the sampled request with the row's actual request", async () => {
      const [transaction] = await recorded([
        {
          described: described({ method: 'GET', path: '/orders' }),
          actual: { request: { headers: { 'x-trace': '1' } } },
        },
      ]);

      expect(transaction?.request.data).toMatchObject({
        method: 'GET',
        path: '/orders',
        headers: { 'x-trace': '1' },
      });
    });

    it('records a templated path at the concrete path the sampler gives it', async () => {
      const rows: ObservedTransaction[] = [
        {
          described: described({
            path: '/orders/{id}',
            pathParameters: {
              id: createParameter({
                schema: { type: 'string', examples: ['42'] },
              }),
            },
          }),
        },
      ];
      const scopedToOrder = httpRule('rules-testing/scoped-to-order')
        .severity('error')
        .type('analytics')
        .rule((ctx) =>
          ctx.validateCommonHttpTransactions({
            appliesTo: path('/orders/42'),
            violatedWhen: constant(true),
          }),
        )
        .done();

      const results = await runInContext('analytics', scopedToOrder, {
        observed: rows,
      });

      expect(violations(results)).toHaveLength(1);
      expect((await recorded(rows))[0]?.request.data.path).toBe('/orders/42');
    });

    it('records the user-agent and the origin server as the roles by default', async () => {
      const [transaction] = await recorded([{ described: described() }]);

      expect(transaction?.request.meta.role).toBe('user-agent');
      expect(transaction?.response.meta.role).toBe('origin server');
    });

    it("records the row's actual roles in place of either default", async () => {
      const [transaction] = await recorded([
        { described: described(), actual: { roles: { response: 'proxy' } } },
      ]);

      expect(transaction?.request.meta.role).toBe('user-agent');
      expect(transaction?.response.meta.role).toBe('proxy');
    });

    it("records the described origin, or the row's actual one", async () => {
      const [fromDescribed, fromActual] = await recorded([
        { described: described({ path: '/a' }) },
        {
          described: described({ path: '/b' }),
          actual: { request: { origin: 'http://elsewhere.example.com:8080' } },
        },
      ]);

      // The analyzer records an origin without its default port.
      expect(fromDescribed?.request.data.origin).toBe(
        'https://api.example.com',
      );
      expect(fromActual?.request.data.origin).toBe(
        'http://elsewhere.example.com:8080',
      );
    });

    it('records several rows for one Operation', async () => {
      const results = await runInContext(
        'analytics',
        flagsDeprecationRecorded,
        {
          observed: [
            {
              described: described({ method: 'POST', path: '/orders' }),
              actual: { response: { headers: { deprecation: 'true' } } },
            },
            {
              described: described({ method: 'POST', path: '/orders' }),
              actual: { response: { headers: { deprecation: 'true' } } },
            },
          ],
        },
      );

      expect(violations(results)).toHaveLength(2);
    });
  });

  // A rule scoped to one Operation: both rows carry the header it flags, so a
  // second violation would mean the out-of-scope row was flagged.
  describe.each<ValidationContext>(['static', 'test', 'analytics'])(
    'for a rule scoped to one Operation, in %s',
    (context) => {
      it('flags the in-scope row and never the out-of-scope one', async () => {
        const scoped = httpRule('rules-testing/scoped')
          .severity('error')
          .type('static', 'test', 'analytics')
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
    },
  );
});
