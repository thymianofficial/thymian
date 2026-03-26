import { isAbsolute, join } from 'node:path';

import {
  type CapturedTrace,
  type CapturedTransaction,
  type Logger,
  type Rule,
  type RuleRunnerAdapter,
  type RulesConfiguration,
  runRules,
  type SerializedThymianFormat,
  type SingleRuleConfiguration,
  ThymianFormat,
  type ThymianPlugin,
  type ThymianReport,
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
        reports: ThymianReport[];
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
        reports: ThymianReport[];
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
  pluginName: string,
  logger: Logger,
  reportFn: (report: ThymianReport) => void,
  format: ThymianFormat,
  repository: SqliteHttpTransactionRepository,
  rulesConfig: RulesConfiguration,
): RuleRunnerAdapter<AnalyticsApiContext> {
  return {
    errorName: 'AnalyzeLinterError',
    category: 'Analytic Checks',
    producer: pluginName,
    mode: 'analytics',
    getRuleFn: (rule: Rule) => rule.analyzeRule,
    createContext: (rule: Rule, options: SingleRuleConfiguration | undefined) =>
      new AnalyticsApiContext(
        repository,
        logger,
        format,
        reportFn,
        rule.meta.appliesTo,
        (options ?? {}).skipOrigins,
      ),
  };
}

export function createHttpAnalyzerPlugin(
  pluginName = '@thymian/http-analyzer',
): ThymianPlugin<HttpAnalyzerPluginOptions> {
  return {
    name: pluginName,
    version: '0.x',
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

          const reports: ThymianReport[] = [];
          const reportFn = (report: ThymianReport) => reports.push(report);

          const { valid, violations } = await runRules(
            logger,
            rules,
            reportFn,
            thymianFormat,
            rulesConfig,
            createAnalyzerAdapter(
              pluginName,
              logger,
              reportFn,
              thymianFormat,
              repo,
              rulesConfig,
            ),
          );

          await repo.close();

          ctx.reply({
            status: valid ? 'success' : 'failed',
            reports,
            violations,
          });
        },
      );

      emitter.onAction(
        'http-analyzer.lint-analytics-batch',
        async ({ format, rules = [], rulesConfig = {} }, ctx) => {
          const thymianFormat = format
            ? ThymianFormat.import(format)
            : new ThymianFormat();
          const reports: ThymianReport[] = [];
          const reportFn = (report: ThymianReport) => reports.push(report);

          const { valid } = await runRules(
            logger,
            rules,
            reportFn,
            thymianFormat,
            rulesConfig,
            createAnalyzerAdapter(
              pluginName,
              logger,
              reportFn,
              thymianFormat,
              initializedRepository,
              rulesConfig,
            ),
          );

          ctx.reply({
            reports,
            valid,
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
          const reports: ThymianReport[] = [];
          const reportFn = (report: ThymianReport) => reports.push(report);

          const { valid } = await runRules(
            logger,
            rules,
            reportFn,
            thymianFormat,
            rulesConfig,
            createAnalyzerAdapter(
              pluginName,
              logger,
              reportFn,
              thymianFormat,
              repo,
              rulesConfig,
            ),
          );

          ctx.reply({
            reports,
            valid,
          });
        },
      );
    },
  };
}

export const httpAnalyzerPlugin = createHttpAnalyzerPlugin();

export default httpAnalyzerPlugin;
