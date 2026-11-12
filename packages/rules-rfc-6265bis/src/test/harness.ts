// The fixture harness: runs one rule in one validation context through that
// context's real engine — the linter's, the tester's and the analyzer's own
// `ApiContext` implementation, driven by core's `runRules` exactly as each
// plugin's adapter drives it — so a fixture proves the assertion is
// *evaluated* there, not merely conceivable (ADR-0021 §4: a declared context
// claims demonstrated). A stub context would prove the rule function and
// nothing about the context.
//
// Nothing here ships: `tsconfig.lib.json` and the dependency-checks lint
// exclude this directory and every `*.fixtures.ts` file, which is why the
// three plugins are devDependencies only (ADR-0009 §5).

import {
  type ApiContext,
  type CapturedTrace,
  type CapturedTransaction,
  createHttpTestContext,
  type HttpRequest,
  type HttpResponse,
  NoopLogger,
  type Rule,
  type RuleFnResult,
  type RuleRunnerAdapter,
  runRules,
  ThymianFormat,
} from '@thymian/core';
import {
  exampleRequestSampler,
  identityHookRunner,
} from '@thymian/core-testing';
import {
  AnalyticsApiContext,
  SqliteHttpTransactionRepository,
} from '@thymian/plugin-http-analyzer';
import { StaticApiContext } from '@thymian/plugin-http-linter';
import { HttpTestApiContext } from '@thymian/plugin-http-tester';

// `static` lints an API description.
export type StaticCase = { format: ThymianFormat };

// `test` sends the requests the description implies; `respond` stands in for
// the server under test and answers each one.
export type TestCase = {
  format: ThymianFormat;
  respond: (request: HttpRequest) => HttpResponse;
};

// `analytics` reads recorded traffic.
export type AnalyticsCase = {
  transactions?: CapturedTransaction[];
  traces?: CapturedTrace[];
  format?: ThymianFormat;
};

export type CaseOf = {
  static: StaticCase;
  test: TestCase;
  analytics: AnalyticsCase;
};

export type FixtureContext = keyof CaseOf;

// One context's fixture: an input the rule must flag, and one it must pass.
// `skips` is for a rule that declares a context but cannot decide every input
// in it — a value the description does not pin — and must say so with a
// `rule-skip` rather than pass silently.
export type ContextFixture<Context extends FixtureContext> = {
  violates: CaseOf[Context];
  conforms: CaseOf[Context];
  skips?: CaseOf[Context];
};

// One fixture module's default export: the rule, and one fixture per context
// it declares.
export type RuleFixtures = { rule: Rule } & {
  [Context in FixtureContext]?: ContextFixture<Context>;
};

const logger = new NoopLogger();

// `runRules` skips a rule whose severity is `off`, and a convention rule ships
// `off` by design; the fixture proves what the rule does once a profile turns
// it on, so it runs at `warn`.
function enabled(rule: Rule): Rule {
  return rule.meta.severity === 'off'
    ? { ...rule, meta: { ...rule.meta, severity: 'warn' } }
    : rule;
}

async function run<Context extends ApiContext>(
  rule: Rule,
  format: ThymianFormat,
  adapter: RuleRunnerAdapter<Context>,
): Promise<RuleFnResult[]> {
  const results = await runRules(logger, [enabled(rule)], format, {}, adapter);
  return results[rule.meta.name]?.ruleFnResult ?? [];
}

const runners: {
  [Context in FixtureContext]: (
    rule: Rule,
    input: CaseOf[Context],
  ) => Promise<RuleFnResult[]>;
} = {
  // As `plugin-http-linter`'s adapter drives it.
  static: (rule, { format }) =>
    run(rule, format, {
      errorName: 'FixtureStaticError',
      mode: 'static',
      getRuleFn: (r) => r.lintRule,
      createContext: () => new StaticApiContext(format, logger),
    }),

  // As `plugin-http-tester`'s adapter drives it, over the context
  // `createContextFromEmitter` would build — except that the sampler reads the
  // description's examples and `respond` answers in place of the dispatcher.
  test: (rule, { format, respond }) => {
    const context = createHttpTestContext({
      format,
      logger,
      locals: {},
      sampleRequest: exampleRequestSampler,
      runRequest: async (request) => respond(request),
      runHook: async (name, payload) => identityHookRunner(name, payload),
    });

    return run(rule, format, {
      errorName: 'FixtureTestError',
      mode: 'test',
      getRuleFn: (r) => r.testRule,
      createContext: (r) => new HttpTestApiContext(r.meta.name, context),
    });
  },

  // As `plugin-http-analyzer`'s adapter drives it, over an in-memory SQLite
  // repository holding the fixture's recorded traffic.
  analytics: async (
    rule,
    { transactions = [], traces = [], format = new ThymianFormat() },
  ) => {
    const repository = new SqliteHttpTransactionRepository(':memory:', logger);
    await repository.init();
    for (const trace of traces) {
      repository.insertHttpTrace(trace);
    }
    for (const transaction of transactions) {
      repository.insertHttpTransaction(transaction);
    }

    try {
      return await run(rule, format, {
        errorName: 'FixtureAnalyticsError',
        mode: 'analytics',
        getRuleFn: (r) => r.analyzeRule,
        createContext: (r) =>
          new AnalyticsApiContext({
            repository,
            logger,
            format,
            roles: r.meta.appliesTo,
          }),
      });
    } finally {
      repository.close();
    }
  },
};

export const fixtureContexts = Object.keys(runners) as FixtureContext[];

export function runInContext<Context extends FixtureContext>(
  context: Context,
  rule: Rule,
  input: CaseOf[Context],
): Promise<RuleFnResult[]> {
  return runners[context](rule, input);
}
