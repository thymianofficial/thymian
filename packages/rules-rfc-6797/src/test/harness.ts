// The fixture harness: runs one rule in one validation context through that
// context's real engine — the linter's, the tester's and the analyzer's own
// `ApiContext` implementation, driven by core's `runRules` exactly as each
// plugin drives it — so a fixture proves the assertion is *evaluated* there,
// not merely conceivable (ADR-0021 §4: a declared context claims
// demonstrated). Nothing here is shipped: `tsconfig.lib.json` excludes this
// directory and every `*.fixtures.ts` file.

import {
  type CapturedTrace,
  type CapturedTransaction,
  createHttpTestContext,
  type HttpRequest,
  type HttpResponse,
  NoopLogger,
  type Rule,
  type RuleFnResult,
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

export type FixtureContext = 'static' | 'test' | 'analytics';

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

type CaseOf<Context extends FixtureContext> = {
  static: StaticCase;
  test: TestCase;
  analytics: AnalyticsCase;
}[Context];

// One fixture: an input the rule must flag, and one it must pass. `skips` is
// for a rule that declares a context but cannot decide every input in it — a
// value the description does not pin — and must say so with a `rule-skip`
// rather than pass silently.
export type ContextFixture<Context extends FixtureContext> = {
  violates: CaseOf<Context>;
  conforms: CaseOf<Context>;
  skips?: CaseOf<Context>;
};

export type RuleFixtures = {
  rule: Rule;
  static?: ContextFixture<'static'>;
  test?: ContextFixture<'test'>;
  analytics?: ContextFixture<'analytics'>;
};

export function defineFixtures(fixtures: RuleFixtures): RuleFixtures {
  return fixtures;
}

const logger = new NoopLogger();

// `runRules` skips a rule whose severity is `off`, and a convention rule ships
// `off` by design; the fixture proves what the rule does once a profile turns
// it on, so it runs at `warn`.
function enabled(rule: Rule): Rule {
  return rule.meta.severity === 'off'
    ? { ...rule, meta: { ...rule.meta, severity: 'warn' } }
    : rule;
}

function resultsOf(
  rule: Rule,
  results: Awaited<ReturnType<typeof runRules>>,
): RuleFnResult[] {
  return results[rule.meta.name]?.ruleFnResult ?? [];
}

export async function runStatic(
  rule: Rule,
  { format }: StaticCase,
): Promise<RuleFnResult[]> {
  const results = await runRules(
    logger,
    [enabled(rule)],
    format,
    {},
    {
      errorName: 'FixtureStaticError',
      mode: 'static',
      getRuleFn: (r) => r.lintRule,
      createContext: () => new StaticApiContext(format, logger),
    },
  );
  return resultsOf(rule, results);
}

export async function runTest(
  rule: Rule,
  { format, respond }: TestCase,
): Promise<RuleFnResult[]> {
  const context = createHttpTestContext({
    format,
    logger,
    locals: {},
    sampleRequest: exampleRequestSampler,
    runRequest: async (request) => respond(request),
    runHook: async (name, payload) => identityHookRunner(name, payload),
  });

  const results = await runRules(
    logger,
    [enabled(rule)],
    format,
    {},
    {
      errorName: 'FixtureTestError',
      mode: 'test',
      getRuleFn: (r) => r.testRule,
      createContext: (r) => new HttpTestApiContext(r.meta.name, context),
    },
  );
  return resultsOf(rule, results);
}

export async function runAnalytics(
  rule: Rule,
  {
    transactions = [],
    traces = [],
    format = new ThymianFormat(),
  }: AnalyticsCase,
): Promise<RuleFnResult[]> {
  const repository = new SqliteHttpTransactionRepository(':memory:', logger);
  await repository.init();
  for (const trace of traces) {
    repository.insertHttpTrace(trace);
  }
  for (const transaction of transactions) {
    repository.insertHttpTransaction(transaction);
  }

  try {
    const results = await runRules(
      logger,
      [enabled(rule)],
      format,
      {},
      {
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
      },
    );
    return resultsOf(rule, results);
  } finally {
    repository.close();
  }
}

export function runInContext<Context extends FixtureContext>(
  context: Context,
  rule: Rule,
  input: CaseOf<Context>,
): Promise<RuleFnResult[]> {
  switch (context) {
    case 'static':
      return runStatic(rule, input as StaticCase);
    case 'test':
      return runTest(rule, input as TestCase);
    case 'analytics':
      return runAnalytics(rule, input as AnalyticsCase);
  }
  throw new Error(`Unknown context: ${String(context)}`);
}
