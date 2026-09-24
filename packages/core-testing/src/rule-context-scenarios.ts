import {
  type ApiContext,
  authorization,
  type CommonHttpRequest,
  type CommonHttpResponse,
  equalsIgnoreCase,
  getHeader,
  type HttpFilterExpression,
  type HttpRequest,
  type HttpResponse,
  type LiveApiContext,
  method,
  protocol,
  requestHeader,
  responseHeader,
  type RuleFnResult,
  type RuleViolationLocation,
  statusCode,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { createHttpRequest } from './factories/http-request.factory.js';
import { createHttpResponse } from './factories/http-response.factory.js';
import { createParameter } from './factories/parameter.factory.js';

/**
 * One transaction as the specification describes it and as it actually
 * happened. A context that observes only the specification ignores `actual`.
 */
export type ScenarioTransaction = {
  described: {
    request: ThymianHttpRequest;
    response: ThymianHttpResponse;
    secured: boolean;
  };
  actual: { request: HttpRequest; response: HttpResponse };
};

export type RuleContextMethod =
  | 'validateCommonHttpTransactions'
  | 'validateHttpTransactions'
  | 'validateGroupedCommonHttpTransactions';

export type ViolatedWhenForm = 'expression' | 'function';

export type RuleContextScenarioSetup = {
  context: ApiContext;
  /** The location a result for the transaction at `index` is expected at. */
  locationOf(index: number, contextMethod: RuleContextMethod): unknown;
};

/**
 * Adapts one rule context to the shared scenario table: it builds the context
 * from the scenario's transactions, whatever that context observes.
 */
export interface RuleContextDriver {
  name: string;
  /** `specification` when the context never sees an actual pair (lint). */
  observes: 'specification' | 'actual pair';
  /** Why a method or filter cannot run in this context, stated in the table. */
  notApplicable?: Partial<
    Record<RuleContextMethod | HttpFilterExpression['type'], string>
  >;
  setup(transactions: ScenarioTransaction[]): Promise<RuleContextScenarioSetup>;
}

type TransactionOptions = {
  path?: string;
  method?: string;
  statusCode?: number;
  protocol?: 'http' | 'https';
  secured?: boolean;
  requestHeaders?: string[];
  responseHeaders?: string[];
};

type ActualOverrides = Pick<
  TransactionOptions,
  'method' | 'requestHeaders' | 'responseHeaders'
>;

function transaction(
  options: TransactionOptions = {},
  actualOverrides: ActualOverrides = {},
): ScenarioTransaction {
  const {
    path = '/users',
    method = 'GET',
    statusCode = 200,
    protocol = 'https',
    secured = false,
    requestHeaders = [],
    responseHeaders = [],
  } = options;
  const actual = {
    method,
    requestHeaders,
    responseHeaders,
    ...actualOverrides,
  };

  return {
    described: {
      request: createHttpRequest({
        path,
        method,
        protocol,
        host: 'api.example.com',
        port: protocol === 'https' ? 443 : 80,
        headers: Object.fromEntries(
          requestHeaders.map((name) => [name, createParameter()]),
        ),
      }),
      response: createHttpResponse({
        statusCode,
        headers: Object.fromEntries(
          responseHeaders.map((name) => [name, createParameter()]),
        ),
      }),
      secured,
    },
    actual: {
      request: {
        origin: `${protocol}://api.example.com`,
        path,
        method: actual.method,
        headers: Object.fromEntries(
          actual.requestHeaders.map((name) => [name, 'value']),
        ),
      },
      response: {
        statusCode,
        headers: Object.fromEntries(
          actual.responseHeaders.map((name) => [name, 'value']),
        ),
        trailers: {},
        duration: 0,
      },
    },
  };
}

type RuleContextScenario = {
  name: string;
  transactions: ScenarioTransaction[];
  appliesTo: HttpFilterExpression;
  /** Indexes of the transactions `appliesTo` accepts in the observation. */
  applicable: number[];
  /** The actual pair differs from the described one beyond name casing. */
  actualDiffersFromDescribed?: boolean;
};

// The Violation Condition every scenario uses: a `Deprecation` response header.
const VIOLATING_HEADER = 'deprecation';

const scenarios: RuleContextScenario[] = [
  {
    name: 'applies and is not violated',
    transactions: [transaction()],
    appliesTo: statusCode(200),
    applicable: [0],
  },
  {
    name: 'applies and is violated',
    transactions: [transaction({ responseHeaders: [VIOLATING_HEADER] })],
    appliesTo: statusCode(200),
    applicable: [0],
  },
  {
    name: 'the described pair does not match appliesTo',
    transactions: [
      transaction({ statusCode: 404, responseHeaders: [VIOLATING_HEADER] }),
    ],
    appliesTo: statusCode(200),
    applicable: [],
  },
  {
    name: 'the described pair matches appliesTo but the actual pair does not',
    transactions: [
      transaction(
        { responseHeaders: ['x-rate-limit', VIOLATING_HEADER] },
        { responseHeaders: [VIOLATING_HEADER] },
      ),
    ],
    appliesTo: responseHeader('x-rate-limit'),
    applicable: [],
    actualDiffersFromDescribed: true,
  },
  {
    name: 'only the pair whose described pair matches appliesTo is validated',
    transactions: [
      transaction({ path: '/a', responseHeaders: [VIOLATING_HEADER] }),
      transaction({
        path: '/b',
        statusCode: 404,
        responseHeaders: [VIOLATING_HEADER],
      }),
    ],
    appliesTo: statusCode(200),
    applicable: [0],
  },
  {
    name: 'only the pair whose actual pair matches appliesTo is validated',
    transactions: [
      transaction({
        path: '/a',
        responseHeaders: ['x-rate-limit', VIOLATING_HEADER],
      }),
      transaction(
        { path: '/b', responseHeaders: ['x-rate-limit', VIOLATING_HEADER] },
        { responseHeaders: [VIOLATING_HEADER] },
      ),
    ],
    appliesTo: responseHeader('x-rate-limit'),
    applicable: [0],
    actualDiffersFromDescribed: true,
  },
  {
    name: 'method("GET") applies to a request sent as "get"',
    transactions: [
      transaction(
        { method: 'GET', responseHeaders: [VIOLATING_HEADER] },
        { method: 'get' },
      ),
    ],
    appliesTo: method('GET'),
    applicable: [0],
  },
  {
    name: 'method("get") applies to a request sent as "GET"',
    transactions: [
      transaction({ method: 'GET', responseHeaders: [VIOLATING_HEADER] }),
    ],
    appliesTo: method('get'),
    applicable: [0],
  },
  {
    name: 'request header names match regardless of casing',
    transactions: [
      transaction(
        {
          requestHeaders: ['x-api-key'],
          responseHeaders: [VIOLATING_HEADER],
        },
        { requestHeaders: ['X-API-KEY'] },
      ),
    ],
    appliesTo: requestHeader('X-Api-Key'),
    applicable: [0],
  },
  {
    name: 'response header names match regardless of casing',
    transactions: [
      transaction(
        { responseHeaders: ['x-rate-limit', VIOLATING_HEADER] },
        { responseHeaders: ['X-RATE-LIMIT', 'Deprecation'] },
      ),
    ],
    appliesTo: responseHeader('X-Rate-Limit'),
    applicable: [0],
  },
  {
    name: 'protocol("https") applies to an https transaction',
    transactions: [
      transaction({ protocol: 'https', responseHeaders: [VIOLATING_HEADER] }),
    ],
    appliesTo: protocol('https'),
    applicable: [0],
  },
  {
    name: 'protocol("https") does not apply to an http transaction',
    transactions: [
      transaction({ protocol: 'http', responseHeaders: [VIOLATING_HEADER] }),
    ],
    appliesTo: protocol('https'),
    applicable: [],
  },
  {
    name: 'authorization() applies to a secured operation',
    transactions: [
      transaction({ secured: true, responseHeaders: [VIOLATING_HEADER] }),
    ],
    appliesTo: authorization(),
    applicable: [0],
  },
  {
    name: 'authorization() does not apply to an unsecured operation',
    transactions: [
      transaction({ secured: false, responseHeaders: [VIOLATING_HEADER] }),
    ],
    appliesTo: authorization(),
    applicable: [],
  },
];

const contextMethods: RuleContextMethod[] = [
  'validateCommonHttpTransactions',
  'validateHttpTransactions',
  'validateGroupedCommonHttpTransactions',
];

function formsOf(contextMethod: RuleContextMethod): ViolatedWhenForm[] {
  return contextMethod === 'validateGroupedCommonHttpTransactions'
    ? ['function']
    : ['expression', 'function'];
}

function hit(location: RuleViolationLocation): RuleFnResult {
  return { location, violation: {}, findings: [] };
}

function hasViolatingHeader(headerNames: string[]): boolean {
  return equalsIgnoreCase(VIOLATING_HEADER, ...headerNames);
}

function responseHeaderNames(
  { described, actual }: ScenarioTransaction,
  observes: RuleContextDriver['observes'],
): string[] {
  return Object.keys(
    observes === 'actual pair'
      ? actual.response.headers
      : described.response.headers,
  );
}

/**
 * Calls `method` in its `{ appliesTo, violatedWhen }` form and records the
 * location of every pair that reached a function `violatedWhen`.
 */
async function validate(
  context: ApiContext,
  contextMethod: RuleContextMethod,
  form: ViolatedWhenForm,
  appliesTo: HttpFilterExpression,
  reached: RuleViolationLocation[],
): Promise<RuleFnResult[]> {
  const common = (
    _req: CommonHttpRequest,
    res: CommonHttpResponse,
    location: RuleViolationLocation,
  ): RuleFnResult[] => {
    reached.push(location);
    return hasViolatingHeader(res.headers) ? [hit(location)] : [];
  };

  switch (contextMethod) {
    case 'validateCommonHttpTransactions':
      return context.validateCommonHttpTransactions({
        appliesTo,
        violatedWhen:
          form === 'expression' ? responseHeader(VIOLATING_HEADER) : common,
      });
    case 'validateHttpTransactions':
      return (context as LiveApiContext).validateHttpTransactions({
        appliesTo,
        violatedWhen:
          form === 'expression'
            ? responseHeader(VIOLATING_HEADER)
            : (_req: HttpRequest, res: HttpResponse, location) => {
                reached.push(location);
                return getHeader(res.headers, VIOLATING_HEADER) !== undefined
                  ? [hit(location)]
                  : [];
              },
      });
    case 'validateGroupedCommonHttpTransactions':
      return context.validateGroupedCommonHttpTransactions({
        appliesTo,
        groupBy: method(),
        violatedWhen: (_key, pairs) =>
          pairs.flatMap(([req, res, location]) => common(req, res, location)),
      });
  }
}

function notApplicableReason(
  driver: RuleContextDriver,
  scenario: RuleContextScenario,
  contextMethod: RuleContextMethod,
): string | undefined {
  if (
    scenario.actualDiffersFromDescribed &&
    driver.observes !== 'actual pair'
  ) {
    return `the ${driver.name} context observes only the specification, so the actual pair is the described pair`;
  }

  return (
    driver.notApplicable?.[contextMethod] ??
    driver.notApplicable?.[scenario.appliesTo.type]
  );
}

/**
 * Runs the scenario table every rule context must agree on (ADR-0022) against
 * the context `driver` builds. A scenario that cannot apply to a context is
 * registered as skipped with the reason in its name, never left out.
 */
export function describeRuleContextScenarios(driver: RuleContextDriver): void {
  describe(`${driver.name}: { appliesTo, violatedWhen } scenarios`, () => {
    for (const contextMethod of contextMethods) {
      describe(contextMethod, () => {
        for (const scenario of scenarios) {
          for (const form of formsOf(contextMethod)) {
            const title = `${scenario.name} (violatedWhen as ${form})`;
            const reason = notApplicableReason(driver, scenario, contextMethod);

            if (reason) {
              it.skip(`${title} — not applicable: ${reason}`, () => undefined);
              continue;
            }

            it(title, async () => {
              const { context, locationOf } = await driver.setup(
                scenario.transactions,
              );
              const reached: RuleViolationLocation[] = [];

              const results = await validate(
                context,
                contextMethod,
                form,
                scenario.appliesTo,
                reached,
              );

              const violated = scenario.transactions.flatMap(
                (transaction, index) =>
                  scenario.applicable.includes(index) &&
                  hasViolatingHeader(
                    responseHeaderNames(transaction, driver.observes),
                  )
                    ? [index]
                    : [],
              );

              expect(results).toEqual(
                violated.map((index) =>
                  expect.objectContaining({
                    location: locationOf(index, contextMethod),
                  }),
                ),
              );

              if (form === 'function') {
                expect(reached).toEqual(
                  scenario.applicable.map((index) =>
                    locationOf(index, contextMethod),
                  ),
                );
              }
            });
          }
        }
      });
    }
  });
}
