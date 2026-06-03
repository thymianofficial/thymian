import { isAbsolute, join } from 'node:path';

import {
  createExecution,
  createToolRun,
  type CapturedTrace,
  type CapturedTransaction,
  executionsFromViolations,
  type EvaluatedRuleViolation,
  type Logger,
  type ReportHttpTransaction,
  type Rule,
  type RuleRunnerAdapter,
  type RulesConfiguration,
  runRules,
  type SerializedThymianFormat,
  type SingleRuleConfiguration,
  ThymianFormat,
  type ThymianPlugin,
  type ToolRun,
} from '@thymian/core';

import { AnalyticsApiContext } from './analytics-api-context.js';
import { SqliteHttpTransactionRepository } from './db/sqlite-http-transaction-repository.js';

export { AnalyticsApiContext } from './analytics-api-context.js';
export type { HttpTransactionRepository } from './db/http-transaction-repository.js';
export { SqliteHttpTransactionRepository } from './db/sqlite-http-transaction-repository.js';

declare module '@thymian/core' {
  interface ThymianActions {
    'http-analyzer.lint-analytics': {
      event: {
        format?: SerializedThymianFormat;
        transactions?: CapturedTransaction[];
        traces?: CapturedTrace[];
        rules?: Rule[];
        rulesConfig?: RulesConfiguration;
      };
      response: {
        runs: ToolRun[];
        violations: EvaluatedRuleViolation[];
        valid: boolean;
      };
    };

    'http-analyzer.lint-analytics-batch': {
      event: {
        format?: SerializedThymianFormat;
        rules?: Rule[];
        rulesConfig?: RulesConfiguration;
      };
      response: {
        runs: ToolRun[];
        violations: EvaluatedRuleViolation[];
        valid: boolean;
      };
    };
  }

  interface ThymianEvents {
    'http-analyzer.transaction': CapturedTransaction;
    'http-analyzer.trace': CapturedTrace;
  }
}

export type HttpAnalyzerStorage =
  | { type: 'memory' }
  | { type: 'sqlite'; path?: string };

export type HttpAnalyzerPluginOptions = {
  storage?: HttpAnalyzerStorage;
};

function createAnalyzerAdapter(
  logger: Logger,
  format: ThymianFormat,
  repository: SqliteHttpTransactionRepository,
): RuleRunnerAdapter<AnalyticsApiContext> {
  return {
    errorName: 'AnalyzeLinterError',
    mode: 'analytics',
    getRuleFn: (rule: Rule) => rule.analyzeRule,
    createContext: (rule: Rule, options: SingleRuleConfiguration | undefined) =>
      new AnalyticsApiContext({
        repository,
        logger,
        format,
        roles: rule.meta.appliesTo,
        skippedOrigins: (options ?? {}).skipOrigins,
      }),
  };
}

function toReportHttpTransaction(
  transaction: CapturedTransaction,
): ReportHttpTransaction {
  return {
    request: transaction.request.data,
    response: transaction.response.data,
  };
}

function createRuns(
  pluginName: string,
  format: ThymianFormat,
  violations: EvaluatedRuleViolation[],
  transactions: CapturedTransaction[] = [],
): ToolRun[] {
  const executions = executionsFromViolations(violations, format);
  const httpTransactions = transactions.map(toReportHttpTransaction);

  if (executions.length === 0 && httpTransactions.length === 0) {
    return [];
  }

  if (executions.length === 0) {
    executions.push(
      createExecution({
        location: { type: 'custom', value: 'analyze' },
        httpTransactions,
      }),
    );
  } else {
    executions[0]!.httpTransactions = httpTransactions;
  }

  return [
    createToolRun({
      tool: { name: pluginName },
      runType: 'analyze',
      executions,
    }),
  ];
}

export function createHttpAnalyzerPlugin(
  pluginName = '@thymian/plugin-http-analyzer',
): ThymianPlugin<HttpAnalyzerPluginOptions> {
  return {
    name: pluginName,
    version: '0.x',
    options: {
      type: 'object',
      nullable: true,
      properties: {
        storage: {
          type: 'object',
          required: ['type'],
          nullable: true,
          oneOf: [
            {
              type: 'object',
              properties: {
                type: { const: 'memory' },
              },
              required: ['type'],
              additionalProperties: false,
            },
            {
              type: 'object',
              properties: {
                type: { const: 'sqlite' },
                path: { type: 'string' },
              },
              required: ['type'],
              additionalProperties: false,
            },
          ],
        },
      },
      additionalProperties: false,
    },
    actions: {
      listensOn: ['core.analyze'],
    },
    events: {
      listensOn: ['http-analyzer.transaction'],
    },
    async plugin(emitter, logger, options) {
      let location = ':memory:';

      if (options.storage?.type === 'sqlite') {
        const filePath = options.storage.path;
        location = filePath
          ? isAbsolute(filePath)
            ? filePath
            : join(options.cwd, filePath)
          : join(options.cwd, '.thymian', 'db', `${Date.now().toString()}.db`);
      }

      const initializedRepository = new SqliteHttpTransactionRepository(
        location,
        logger.child(`${pluginName}:HttpTransactionRepository`),
      );
      await initializedRepository.init();

      emitter.onAction('core.close', async (_, ctx) => {
        await initializedRepository.close();
        ctx.reply();
      });

      emitter.on('http-analyzer.transaction', (transaction) => {
        initializedRepository.insertHttpTransaction(transaction);
      });

      emitter.onAction(
        'core.analyze',
        async ({ format, rules = [], rulesConfig = {}, traffic }, ctx) => {
          const thymianFormat = format
            ? ThymianFormat.import(format)
            : new ThymianFormat();

          const repo = new SqliteHttpTransactionRepository(
            ':memory:',
            logger.child(`${pluginName}:HttpTransactionRepository`),
          );
          await repo.init();

          for (const trace of traffic.traces ?? []) {
            repo.insertHttpTrace(trace);
          }

          for (const transaction of traffic.transactions ?? []) {
            repo.insertHttpTransaction(transaction);
          }

          const { violations } = await runRules(
            logger,
            rules,
            thymianFormat,
            rulesConfig,
            createAnalyzerAdapter(logger, thymianFormat, repo),
          );

          await repo.close();

          ctx.reply(
            createRuns(
              pluginName,
              thymianFormat,
              violations,
              traffic.transactions ?? [],
            ),
          );
        },
      );

      emitter.onAction(
        'http-analyzer.lint-analytics-batch',
        async ({ format, rules = [], rulesConfig = {} }, ctx) => {
          const thymianFormat = format
            ? ThymianFormat.import(format)
            : new ThymianFormat();

          const { violations } = await runRules(
            logger,
            rules,
            thymianFormat,
            rulesConfig,
            createAnalyzerAdapter(
              logger,
              thymianFormat,
              initializedRepository,
            ),
          );

          ctx.reply({
            runs: createRuns(pluginName, thymianFormat, violations),
            violations,
            valid: violations.length === 0,
          });
        },
      );

      emitter.onAction(
        'http-analyzer.lint-analytics',
        async (
          { format, traces, transactions, rules = [], rulesConfig = {} },
          ctx,
        ) => {
          const repo = new SqliteHttpTransactionRepository(
            ':memory:',
            logger.child(`${pluginName}:HttpTransactionRepository`),
          );
          await repo.init();

          for (const trace of traces ?? []) {
            repo.insertHttpTrace(trace);
          }

          for (const transaction of transactions ?? []) {
            repo.insertHttpTransaction(transaction);
          }

          const thymianFormat = format
            ? ThymianFormat.import(format)
            : new ThymianFormat();

          const { violations } = await runRules(
            logger,
            rules,
            thymianFormat,
            rulesConfig,
            createAnalyzerAdapter(logger, thymianFormat, repo),
          );

          await repo.close();

          ctx.reply({
            runs: createRuns(
              pluginName,
              thymianFormat,
              violations,
              transactions ?? [],
            ),
            violations,
            valid: violations.length === 0,
          });
        },
      );
    },
  };
}

export const httpAnalyzerPlugin = createHttpAnalyzerPlugin();

export default httpAnalyzerPlugin;
