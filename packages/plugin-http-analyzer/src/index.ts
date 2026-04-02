import { isAbsolute, join } from 'node:path';

import {
  type CapturedTrace,
  type CapturedTransaction,
  type EvaluatedRuleViolation,
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
        reports: ThymianReport[];
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
  reportFn: (report: ThymianReport) => void,
  format: ThymianFormat,
  repository: SqliteHttpTransactionRepository,
): RuleRunnerAdapter<AnalyticsApiContext> {
  return {
    errorName: 'AnalyzeLinterError',
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
  pluginName = '@thymian/plugin-http-analyzer',
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

          const reportFn = (report: ThymianReport) =>
            emitter.emit('core.report', report);

          const { violations, statistics } = await runRules(
            logger,
            rules,
            thymianFormat,
            rulesConfig,
            createAnalyzerAdapter(logger, reportFn, thymianFormat, repo),
          );

          await repo.close();

          ctx.reply({
            source: pluginName,
            status: violations.length === 0 ? 'success' : 'failed',
            violations,
            statistics,
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

          const { violations } = await runRules(
            logger,
            rules,
            thymianFormat,
            rulesConfig,
            createAnalyzerAdapter(
              logger,
              reportFn,
              thymianFormat,
              initializedRepository,
            ),
          );

          ctx.reply({
            reports,
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
          const reports: ThymianReport[] = [];
          const reportFn = (report: ThymianReport) => reports.push(report);

          const { violations } = await runRules(
            logger,
            rules,
            thymianFormat,
            rulesConfig,
            createAnalyzerAdapter(logger, reportFn, thymianFormat, repo),
          );

          ctx.reply({
            reports,
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
