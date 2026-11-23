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
  origin,
  path,
  port,
  protocol,
  requestHeader,
  responseHeader,
  responseWith,
  type RuleFnResult,
  type RuleViolationGroupLocation,
  type RuleViolationLocation,
  statusCode,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
  url,
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
  /**
   * The context re-checks `appliesTo` on the live pair and reports what it
   * found: a `rule-skip` for a pair it rejects, a `Status drift` finding for
   * a pair it judges with another status than declared (ADR-0028).
   */
  reportsLiveChecks?: boolean;
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
  'path' | 'method' | 'statusCode' | 'requestHeaders' | 'responseHeaders'
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
    path,
    method,
    statusCode,
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
        path: actual.path,
        method: actual.method,
        headers: Object.fromEntries(
          actual.requestHeaders.map((name) => [name, 'value']),
        ),
      },
      response: {
        statusCode: actual.statusCode,
        headers: {
          // As described: the response factory declares a JSON body.
          'content-type': 'application/json',
          ...Object.fromEntries(
            actual.responseHeaders.map((name) => [name, 'value']),
          ),
        },
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
  /**
   * Indexes of the transactions sent for their described pair whose actual
   * pair `appliesTo` rejects, which a context that reports live checks skips.
   */
  skipped?: number[];
  /**
   * Indexes of the judged transactions whose actual status differs from the
   * described one, for which a context that reports live checks reports a finding.
   */
  drifted?: number[];
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
    skipped: [0],
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
    skipped: [1],
  },
  {
    name: 'a live status the description does not declare is still judged',
    transactions: [
      transaction({ responseHeaders: [VIOLATING_HEADER] }, { statusCode: 501 }),
    ],
    appliesTo: method('GET'),
    applicable: [0],
    actualDiffersFromDescribed: true,
    drifted: [0],
  },
  {
    name: 'a live status that does not match appliesTo is not judged',
    transactions: [
      transaction({ responseHeaders: [VIOLATING_HEADER] }, { statusCode: 500 }),
    ],
    appliesTo: statusCode(200),
    applicable: [],
    actualDiffersFromDescribed: true,
    skipped: [0],
  },
  {
    name: 'one live status that does not match appliesTo leaves the others judged',
    transactions: [
      transaction({ path: '/a', responseHeaders: [VIOLATING_HEADER] }),
      transaction(
        { path: '/b', responseHeaders: [VIOLATING_HEADER] },
        { statusCode: 500 },
      ),
    ],
    appliesTo: statusCode(200),
    applicable: [0],
    actualDiffersFromDescribed: true,
    skipped: [1],
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
  {
    name: 'path() names the path template, not the concrete path sent',
    transactions: [
      transaction(
        { path: '/users/{id}', responseHeaders: [VIOLATING_HEADER] },
        { path: '/users/42' },
      ),
    ],
    appliesTo: path('/users/{id}'),
    applicable: [0],
  },
  {
    name: 'port(443) applies to an https transaction on the default port',
    transactions: [
      transaction({ protocol: 'https', responseHeaders: [VIOLATING_HEADER] }),
    ],
    appliesTo: port(443),
    applicable: [0],
  },
  {
    name: 'origin() spells the default port explicitly',
    transactions: [
      transaction({ protocol: 'https', responseHeaders: [VIOLATING_HEADER] }),
    ],
    appliesTo: origin('https://api.example.com:443'),
    applicable: [0],
  },
  {
    name: 'url() spells the default port explicitly',
    transactions: [
      transaction({ protocol: 'https', responseHeaders: [VIOLATING_HEADER] }),
    ],
    appliesTo: url('https://api.example.com:443/users'),
    applicable: [0],
  },
  {
    name: 'responseWith() asks the declared responses, not the pair that came back',
    transactions: [
      transaction(
        { responseHeaders: ['x-rate-limit', VIOLATING_HEADER] },
        { responseHeaders: [VIOLATING_HEADER] },
      ),
    ],
    appliesTo: responseWith(responseHeader('x-rate-limit')),
    applicable: [0],
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
): Promise<RuleFnResult<RuleViolationLocation | RuleViolationGroupLocation>[]> {
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

/**
 * What a context that reports live checks returns besides violations: a
 * `rule-skip` per skipped pair and a `Status drift` finding per drifted one. A
 * grouped call skips on the group, and only when it skips every pair sent;
 * `groupBy: method()` puts every pair of a scenario in one group.
 */
function liveCheckResults(
  driver: RuleContextDriver,
  scenario: RuleContextScenario,
  contextMethod: RuleContextMethod,
  locationOf: RuleContextScenarioSetup['locationOf'],
): unknown[] {
  if (!driver.reportsLiveChecks) {
    return [];
  }

  const skipped = scenario.skipped ?? [];
  const skip = [expect.objectContaining({ kind: 'rule-skip' })];
  const skips =
    contextMethod === 'validateGroupedCommonHttpTransactions'
      ? skipped.length > 0 && scenario.applicable.length === 0
        ? [
            expect.objectContaining({
              location: expect.objectContaining({ elementType: 'group' }),
              findings: skip,
            }),
          ]
        : []
      : skipped.map((index) =>
          expect.objectContaining({
            location: locationOf(index, contextMethod),
            findings: skip,
          }),
        );
  const drifts = (scenario.drifted ?? []).map((index) =>
    expect.objectContaining({
      location: locationOf(index, contextMethod),
      findings: [
        expect.objectContaining({
          kind: 'informational',
          title: 'Status drift',
        }),
      ],
    }),
  );

  return [...skips, ...drifts];
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
 * Runs the scenario table every rule context must agree on (ADR-0025) against
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

              const expected = [
                ...violated.map((index) =>
                  expect.objectContaining({
                    location: locationOf(index, contextMethod),
                    violation: expect.anything(),
                  }),
                ),
                ...liveCheckResults(
                  driver,
                  scenario,
                  contextMethod,
                  locationOf,
                ),
              ];
              expect(results).toHaveLength(expected.length);
              expect(results).toEqual(expect.arrayContaining(expected));

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
