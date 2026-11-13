import {
  createHttpTestContext,
  type HttpRequest,
  type HttpResponse,
  type HttpTestContext,
  type HttpTestHooks,
  NoopLogger,
  resolveViolationLocation,
  type RuleRunnerAdapter,
  type RuleViolationLocation,
  runRules,
  type TestCaseExecution,
  type ThymianFormat,
} from '@thymian/core';
import {
  exampleRequestSampler,
  identityHookRunner,
} from '@thymian/core-testing';
import {
  createRuns,
  HttpTestApiContext,
  type HttpTesterRuleDiagnostics,
} from '@thymian/plugin-http-tester';

import { conformingResponse } from './conforming-response.js';
import {
  listExecutions,
  type RuleTestExecution,
  withEngineLabel,
} from './rule-test-execution.js';
import type { RuleUnderTest } from './rule-under-test.js';

const logger = new NoopLogger();

/**
 * What a responder is asked to answer.
 */
export type RespondInput = {
  /** The id of the transaction the request is aimed at. */
  transaction: string;
  /** The response that answers the transaction exactly as the format declares it. */
  conforming: HttpResponse;
  /** The request that was sent. */
  request: HttpRequest;
};

/**
 * The server under test of a rule test: decides what comes back for a request.
 */
export type Respond = (
  input: RespondInput,
) => HttpResponse | Promise<HttpResponse>;

/**
 * Runs a rule in `test`: the tester's own context evaluates it, sending the
 * requests it builds to `respond` instead of a server, and the tester's own
 * report builder turns what it returns into executions, as for `thymian test`.
 */
export async function runTest(
  { rule, rulesConfig, declaredSeverity }: RuleUnderTest,
  format: ThymianFormat,
  respond: Respond = ({ conforming }) => conforming,
): Promise<RuleTestExecution[]> {
  const context = createHttpTestContext({
    format,
    logger,
    locals: {},
    sampleRequest: exampleRequestSampler,
    ...respondingWith(respond),
  });

  const adapter: RuleRunnerAdapter<
    HttpTestApiContext,
    HttpTesterRuleDiagnostics
  > = {
    errorName: 'TestLinterError',
    mode: 'test',
    getRuleFn: (rule) => rule.testRule,
    createContext: (rule) => new HttpTestApiContext(rule.meta.name, context),
  };

  const result = await runRules(logger, [rule], format, rulesConfig, adapter);
  const [run] = createRuns(
    '@thymian/rules-testing',
    result,
    [rule],
    format,
    logger,
  );

  // An execution the tester could tie to no request it sent carries only the
  // heading of its location as its name; the location itself is the one the
  // rule returned under that heading.
  const returnedLocations = new Map<string, RuleViolationLocation>();
  for (const { location } of result[rule.meta.name]?.ruleFnResult ?? []) {
    const { heading } = resolveViolationLocation(
      location,
      format,
      rule.meta.name,
    );
    if (!returnedLocations.has(heading)) {
      returnedLocations.set(heading, location);
    }
  }

  const executions = run?.runType === 'test' ? (run.executions ?? []) : [];
  const reported = executions.map((execution): RuleTestExecution => {
    const { status, steps } = execution;

    return {
      location: withEngineLabel(
        locationOf(execution, returnedLocations),
        format,
        rule,
      ),
      status: status.kind,
      ...(status.kind === 'failed'
        ? {
            // The tester leaves the reason out when the rule gave no
            // message, where the other engines name the rule.
            message:
              status.reason ??
              rule.meta.summary ??
              rule.meta.description ??
              rule.meta.name,
            severity: declaredSeverity,
          }
        : {}),
      ...(status.kind === 'skipped' && status.reason !== undefined
        ? { reason: status.reason }
        : {}),
      // The tester repeats a violation as a `rule-violation` finding on its
      // step, which a rule cannot attach itself and `message` already says.
      findings: steps
        .flatMap(({ findings }) => findings)
        .filter(({ kind }) => kind !== 'rule-violation'),
    };
  });

  // The tester reports an execution for every transaction it sent a request
  // for, so one it reported nothing on is one the rule did not apply to.
  return listExecutions(format, reported, () => false);
}

/**
 * The two members of the tester's context that stand for the server.
 *
 * The tester hands `runRequest` the request alone, and two answers of one
 * operation are asked for with the same request, so the transaction a request
 * is aimed at is known only where the tester passes the response on together
 * with it: the `afterResponse` step of its context. The responder answers
 * there. No hook is registered or run; the other steps pass their value
 * through.
 */
function respondingWith(
  respond: Respond,
): Pick<HttpTestContext, 'runRequest' | 'runHook'> {
  const unanswered: HttpResponse = {
    statusCode: 0,
    headers: {},
    trailers: {},
    duration: 0,
  };

  return {
    runRequest: async () => unanswered,
    async runHook<Hook extends keyof HttpTestHooks>(
      name: Hook,
      payload: HttpTestHooks[Hook]['arg'],
    ): Promise<HttpTestHooks[Hook]['return']> {
      if (name !== 'afterResponse') {
        return identityHookRunner(name, payload);
      }

      const { request, thymianTransaction } = (
        payload as HttpTestHooks['afterResponse']['arg']
      ).ctx;

      if (thymianTransaction === undefined) {
        throw new Error(
          `The request ${request.method.toUpperCase()} ${request.path} is aimed at no transaction of the format, so a rule test cannot answer it.`,
        );
      }

      const result = await respond({
        transaction: thymianTransaction.transactionId,
        conforming: conformingResponse(thymianTransaction.thymianRes),
        request,
      });

      return { result } as HttpTestHooks[Hook]['return'];
    },
  };
}

/**
 * Where the tester located an execution: on the transaction of its first
 * step, as the engine reports it, or on whatever the rule returned when the
 * tester sent no request for it.
 */
function locationOf(
  { name, steps }: TestCaseExecution,
  returnedLocations: Map<string, RuleViolationLocation>,
): RuleViolationLocation {
  const location = steps[0]?.location;

  if (location?.type === 'thymianFormat') {
    const { elementType, elementId, pointer } = location;
    return { elementType, elementId, pointer };
  }

  if (location?.type === 'custom') {
    return location.value;
  }

  return returnedLocations.get(name) ?? name;
}
