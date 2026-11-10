// Runs one rule in one validation context through that context's real engine
// — the linter's, the tester's and the analyzer's own `ApiContext`
// implementation, driven by core's `runRules` exactly as each plugin drives it
// — so a passing test proves the assertion is *evaluated* there, not merely
// conceivable (ADR-0021 §4). A stub context would prove the rule function and
// nothing about the context.
//
// The three plugins are optional peers: each is imported only when its context
// runs, so an author installs just the engines for the contexts a rule set
// declares.

import {
  type ApiContext,
  type CapturedTrace,
  type CapturedTransaction,
  createHttpTestContext,
  type HttpTestContext,
  type Logger,
  NoopLogger,
  type Rule,
  type RuleFnResult,
  type RuleRunnerAdapter,
  type RulesConfiguration,
  type RuleSeverity,
  type RuleType,
  ruleTypes,
  runRules,
  type SingleRuleConfiguration,
  ThymianFormat,
} from '@thymian/core';
import {
  exampleRequestSampler,
  identityHookRunner,
} from '@thymian/core-testing';

/** A context a rule can run in: every `RuleType` but `informational`. */
export type ValidationContext = Exclude<RuleType, 'informational'>;

export const validationContexts: readonly ValidationContext[] =
  ruleTypes.filter(
    (type): type is ValidationContext => type !== 'informational',
  );

type CommonInput = {
  /**
   * The configuration of the rule under test, as a Thymian config file would
   * give it. Without a severity, a rule shipped `off` runs at `warn`.
   */
  config?: RuleSeverity | SingleRuleConfiguration;
  /** Defaults to a `NoopLogger`. */
  logger?: Logger;
};

/** `static` lints an API description. */
export type StaticInput = CommonInput & { format: ThymianFormat };

/**
 * `test` sends the requests the description implies; `runRequest` stands in
 * for the server under test. The rest mirrors `createHttpTestContext`, with
 * `exampleRequestSampler`, `identityHookRunner` and `{}` as defaults.
 */
export type TestInput = CommonInput &
  Pick<HttpTestContext, 'format' | 'runRequest'> &
  Partial<Pick<HttpTestContext, 'sampleRequest' | 'runHook' | 'locals'>>;

/**
 * `analytics` reads recorded traffic, held in the harness's own in-memory
 * SQLite repository.
 */
export type AnalyticsInput = CommonInput & {
  transactions?: CapturedTransaction[];
  traces?: CapturedTrace[];
  format?: ThymianFormat;
};

type Inputs = {
  static: StaticInput;
  test: TestInput;
  analytics: AnalyticsInput;
};

export type InputOf<Context extends ValidationContext> = Inputs[Context];

const plugins = {
  static: '@thymian/plugin-http-linter',
  test: '@thymian/plugin-http-tester',
  analytics: '@thymian/plugin-http-analyzer',
} as const satisfies Record<ValidationContext, string>;

// The plugin is an optional peer: when it is not installed, say which context
// needs which package rather than surfacing a bare module-resolution error.
// Any other failure, including a dependency of an installed plugin that is
// missing, is not ours to rename.
export async function loadPlugin<Module>(
  context: ValidationContext,
  packageName: string,
  load: () => Promise<Module>,
): Promise<Module> {
  try {
    return await load();
  } catch (error) {
    if (isMissing(error, packageName)) {
      throw new Error(`the \`${context}\` context needs \`${packageName}\``, {
        cause: error,
      });
    }
    throw error;
  }
}

function isMissing(error: unknown, packageName: string): boolean {
  return (
    error instanceof Error &&
    (error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND' &&
    error.message.includes(packageName)
  );
}

// Applies the caller's configuration to the rule as core's rule loader does.
// `runRules` skips a rule whose severity is `off`, and a convention rule ships
// `off` by design; a test proves what the rule does once a profile turns it
// on, so without an explicit severity it runs at `warn`.
function configure(
  rule: Rule,
  config: CommonInput['config'],
): { rule: Rule; rulesConfig: RulesConfiguration } {
  const single = typeof config === 'object' ? config : undefined;
  const severity =
    typeof config === 'string'
      ? config
      : (single?.severity ??
        (rule.meta.severity === 'off' ? 'warn' : rule.meta.severity));

  return {
    rule: {
      ...rule,
      meta: {
        ...rule.meta,
        severity,
        type: single?.type ?? rule.meta.type,
      },
    },
    rulesConfig: config === undefined ? {} : { [rule.meta.name]: config },
  };
}

async function run<Context extends ApiContext>(
  rule: Rule,
  input: CommonInput & { format: ThymianFormat },
  adapter: RuleRunnerAdapter<Context>,
): Promise<RuleFnResult[]> {
  const { rule: configured, rulesConfig } = configure(rule, input.config);
  const results = await runRules(
    input.logger ?? new NoopLogger(),
    [configured],
    input.format,
    rulesConfig,
    adapter,
  );
  return results[rule.meta.name]?.ruleFnResult ?? [];
}

const runners: {
  [Context in ValidationContext]: (
    rule: Rule,
    input: InputOf<Context>,
  ) => Promise<RuleFnResult[]>;
} = {
  // As `plugin-http-linter`'s adapter drives it.
  static: async (rule, input) => {
    const { StaticApiContext } = await loadPlugin(
      'static',
      plugins.static,
      () => import('@thymian/plugin-http-linter'),
    );
    const logger = input.logger ?? new NoopLogger();

    return run(rule, input, {
      errorName: 'RulesTestingStaticError',
      mode: 'static',
      getRuleFn: (r) => r.lintRule,
      createContext: (_r, options) =>
        new StaticApiContext(input.format, logger, options?.skipOrigins),
    });
  },

  // As `plugin-http-tester`'s adapter drives it, over the context
  // `createContextFromEmitter` would build, except that the caller's
  // `runRequest` answers in place of the dispatcher.
  test: async (rule, input) => {
    const { HttpTestApiContext } = await loadPlugin(
      'test',
      plugins.test,
      () => import('@thymian/plugin-http-tester'),
    );
    const context = createHttpTestContext({
      format: input.format,
      logger: input.logger ?? new NoopLogger(),
      locals: input.locals ?? {},
      sampleRequest: input.sampleRequest ?? exampleRequestSampler,
      runRequest: input.runRequest,
      runHook:
        input.runHook ??
        (async (name, payload) => identityHookRunner(name, payload)),
    });

    return run(rule, input, {
      errorName: 'RulesTestingTestError',
      mode: 'test',
      getRuleFn: (r) => r.testRule,
      createContext: (r, options) =>
        new HttpTestApiContext(r.meta.name, context, options?.skipOrigins),
    });
  },

  // As `plugin-http-analyzer`'s adapter drives it, over an in-memory SQLite
  // repository holding the input's recorded traffic.
  analytics: async (rule, input) => {
    const { AnalyticsApiContext, SqliteHttpTransactionRepository } =
      await loadPlugin(
        'analytics',
        plugins.analytics,
        () => import('@thymian/plugin-http-analyzer'),
      );
    const logger = input.logger ?? new NoopLogger();
    const format = input.format ?? new ThymianFormat();

    const repository = new SqliteHttpTransactionRepository(':memory:', logger);
    await repository.init();
    for (const trace of input.traces ?? []) {
      repository.insertHttpTrace(trace);
    }
    for (const transaction of input.transactions ?? []) {
      repository.insertHttpTransaction(transaction);
    }

    try {
      return await run(
        rule,
        { ...input, format },
        {
          errorName: 'RulesTestingAnalyticsError',
          mode: 'analytics',
          getRuleFn: (r) => r.analyzeRule,
          createContext: (r, options) =>
            new AnalyticsApiContext({
              repository,
              logger,
              format,
              roles: r.meta.appliesTo,
              skippedOrigins: options?.skipOrigins,
            }),
        },
      );
    } finally {
      await repository.close();
    }
  },
};

/**
 * Runs `rule` in `context` through that context's real engine and resolves to
 * what the rule reported. A rule that does not run in `context`, including one
 * configured `off`, resolves to `[]`.
 *
 * Rejects when the plugin that provides `context` is not installed.
 */
export function runInContext<Context extends ValidationContext>(
  context: Context,
  rule: Rule,
  input: InputOf<Context>,
): Promise<RuleFnResult[]> {
  return runners[context](rule, input);
}
