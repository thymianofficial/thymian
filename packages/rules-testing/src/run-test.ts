import {
  createHttpTestContext,
  type HttpRequest,
  type HttpResponse,
  type HttpTestCase,
  type HttpTestContext,
  type HttpTestHooks,
  isGroupedHttpTestCaseStep,
  isRuleViolationGroupLocation,
  NoopLogger,
  resolveViolationLocation,
  type RuleFnResult,
  type RuleRunnerAdapter,
  type RuleViolationLocation,
  runRules,
  type TestCaseExecution,
  type ThymianFormat,
  type ThymianHttpTransaction,
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
  executionsElsewhere,
  executionsOn,
  listExecutions,
  reportedExecutions,
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
  underTest: RuleUnderTest,
  format: ThymianFormat,
  respond: Respond = ({ conforming }) => conforming,
): Promise<RuleTestExecution[]> {
  const { rule, rulesConfig, declaredSeverity } = underTest;
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
    // A group is located on its members, further down.
    if (isRuleViolationGroupLocation(location)) {
      continue;
    }
    const { heading } = resolveViolationLocation(
      location,
      format,
      rule.meta.name,
    );
    if (!returnedLocations.has(heading)) {
      returnedLocations.set(heading, location);
    }
  }

  const onItsLocation = (execution: TestCaseExecution): RuleTestExecution => {
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
  };

  const executions = run?.runType === 'test' ? (run.executions ?? []) : [];
  // The tester reports one execution per test case, in the order it ran them.
  const groups = (result[rule.meta.name]?.diagnostics ?? []).flatMap(
    ({ testResult, placements }) =>
      testResult.cases.map((testCase, testCaseIndex) =>
        groupOf(
          testCase,
          placements
            .filter((placement) => placement.testCaseIndex === testCaseIndex)
            .map((placement) => placement.result),
        ),
      ),
  );

  const reported = executions.flatMap((execution, index) => {
    const group = groups[index];

    return group === undefined
      ? [onItsLocation(execution)]
      : executionsOnMembers(group, execution, underTest, format);
  });

  // The tester reports an execution for every transaction it sent a request
  // for, so one it reported nothing on is one the rule did not apply to.
  return listExecutions(format, reported, () => false);
}

/**
 * The group a test case ran: the transactions the tester sent a request for
 * together, and what the rule returned about them.
 */
type TestedGroup = {
  members: ThymianHttpTransaction[];
  returned: RuleFnResult[];
};

/** The group of a test case of a grouped rule; none for any other case. */
function groupOf(
  { steps }: HttpTestCase,
  returned: RuleFnResult[],
): TestedGroup | undefined {
  const [step] = steps;

  if (step === undefined || !isGroupedHttpTestCaseStep(step)) {
    return undefined;
  }

  return {
    members: step.transactions.flatMap(({ source }) =>
      source === undefined ? [] : [source],
    ),
    returned,
  };
}

/**
 * The tester reports a group as one execution, on the group key: failed when
 * the rule returned a violation on any of it. Who is at fault is in what the
 * rule returned, read as core's report builder reads it in `static`: a member
 * it located a violation on, or the group, which is every member. A member the
 * rule returned nothing on has the status of the execution, and where that is
 * the failure of another member, it passed.
 */
function executionsOnMembers(
  { members, returned }: TestedGroup,
  { status }: TestCaseExecution,
  underTest: RuleUnderTest,
  format: ThymianFormat,
): RuleTestExecution[] {
  const said = reportedExecutions(
    {
      [underTest.rule.meta.name]: {
        diagnostics: undefined,
        ruleFnResult: returned,
      },
    },
    underTest,
    format,
    'lint',
  );
  const skipped: Partial<RuleTestExecution> =
    status.kind === 'skipped'
      ? {
          status: 'skipped',
          ...(status.reason !== undefined ? { reason: status.reason } : {}),
        }
      : {};

  return [
    ...members.flatMap((member) =>
      executionsOn(member, said, 'passed').map((execution) =>
        said.includes(execution) ? execution : { ...execution, ...skipped },
      ),
    ),
    ...executionsElsewhere(members, said),
  ];
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
