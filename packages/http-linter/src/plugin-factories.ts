import { isAbsolute, join } from 'node:path';

import {
  type CoreAnalyzeInput,
  type Logger,
  type Rule,
  ThymianEmitter,
  ThymianFormat,
  type ThymianPlugin,
  type ThymianReport,
  type ValidationResult,
} from '@thymian/core';

import { SqliteHttpTransactionRepository } from './db/sqlite/sqlite-http-transaction-repository.js';
import { AnalyticsLinter } from './linter/analytics-linter.js';
import { createContext } from './linter/create-context.js';
import { HttpTestLinter } from './linter/http-test-linter.js';
import { StaticLinter } from './linter/static-linter.js';
import { loadRules } from './load-rules.js';
import type { RuleType } from './rule/rule-meta.js';
import type { RulesConfiguration } from './rule-configuration.js';
import { createRuleFilter } from './rule-filter.js';

export type AnalyticsOptions = {
  captureTransactions?:
    | {
        type: 'in-memory';
      }
    | {
        type: 'file';
        filePath?: string;
      };
};

export type BaseHttpValidationPluginOptions = {
  ruleSets: string[];
  severity?: 'off' | 'error' | 'warn' | 'hint';
  rules?: RulesConfiguration;
};

export type HttpLinterPluginOptions = BaseHttpValidationPluginOptions & {
  type?: RuleType[];
  analytics?: AnalyticsOptions;
};

export type HttpTesterPluginOptions = BaseHttpValidationPluginOptions;

export type HttpAnalyzerPluginOptions = BaseHttpValidationPluginOptions & {
  analytics?: AnalyticsOptions;
};

export function createHttpLinterPlugin(
  pluginName = '@thymian/http-linter-plugin',
): ThymianPlugin<HttpLinterPluginOptions> {
  return {
    name: pluginName,
    version: '0.x',
    actions: {
      listensOn: ['core.lint'],
    },
    async plugin(emitter, logger, options) {
      const ruleFilter = createRuleFilter({
        severity: options.severity ?? 'hint',
        type: ['static'],
      });
      const loadedRules = await loadRules(
        options.ruleSets,
        ruleFilter,
        options.rules ?? {},
      );

      emitter.onAction('core.lint', async ({ format, rules = [] }, ctx) => {
        const result = await runLintValidation(
          logger,
          emitter,
          ThymianFormat.import(format),
          selectRules(rules, loadedRules, ruleFilter),
          options.rules ?? {},
        );

        ctx.reply(result);
      });

      emitter.onAction('http-linter.lint-static', async ({ format }, ctx) => {
        const reports: ThymianReport[] = [];
        const linter = new StaticLinter(
          logger,
          loadedRules,
          (report) => reports.push(report),
          ThymianFormat.import(format),
          options.rules ?? {},
        );

        ctx.reply({
          reports,
          valid: await linter.run(),
        });
      });

      emitter.onAction('http-linter.load-rules', async ({ rules }, ctx) => {
        loadedRules.push(
          ...(await loadRules(rules, ruleFilter, options.rules ?? {})),
        );
        ctx.reply();
      });

      emitter.onAction('http-linter.rules', (_, ctx) => {
        ctx.reply(loadedRules);
      });
    },
  };
}

export function createHttpTesterPlugin(
  pluginName = '@thymian/http-tester-plugin',
): ThymianPlugin<HttpTesterPluginOptions> {
  return {
    name: pluginName,
    version: '0.x',
    actions: {
      listensOn: ['core.test'],
    },
    async plugin(emitter, logger, options) {
      const ruleFilter = createRuleFilter({
        severity: options.severity ?? 'hint',
        type: ['test'],
      });
      const loadedRules = await loadRules(
        options.ruleSets,
        ruleFilter,
        options.rules ?? {},
      );

      emitter.onAction('core.test', async ({ format, rules = [] }, ctx) => {
        const result = await runTestValidation(
          logger,
          emitter,
          ThymianFormat.import(format),
          selectRules(rules, loadedRules, ruleFilter),
          options.rules ?? {},
        );

        ctx.reply(result);
      });
    },
  };
}

export function createHttpAnalyzerPlugin(
  pluginName = '@thymian/http-analyzer-plugin',
): ThymianPlugin<HttpAnalyzerPluginOptions> {
  return {
    name: pluginName,
    version: '0.x',
    actions: {
      listensOn: ['core.analyze'],
    },
    events: {
      listensOn: ['http-linter.transaction'],
    },
    async plugin(emitter, logger, options) {
      const ruleFilter = createRuleFilter({
        severity: options.severity ?? 'hint',
        type: ['analytics'],
      });
      const loadedRules = await loadRules(
        options.ruleSets,
        ruleFilter,
        options.rules ?? {},
      );

      let location = ':memory:';

      if (options.analytics?.captureTransactions?.type === 'file') {
        const filePath = options.analytics.captureTransactions.filePath;
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

      emitter.on('http-linter.transaction', (transaction) => {
        initializedRepository.insertHttpTransaction(transaction);
      });

      emitter.onAction(
        'core.analyze',
        async ({ format, rules = [], traffic }, ctx) => {
          const result = await runAnalyzeValidation(
            logger,
            emitter,
            selectRules(rules, loadedRules, ruleFilter),
            options.rules ?? {},
            traffic,
            format ? ThymianFormat.import(format) : new ThymianFormat(),
          );

          ctx.reply(result);
        },
      );

      emitter.onAction(
        'http-linter.lint-analytics-batch',
        async ({ format }, ctx) => {
          const reports: ThymianReport[] = [];
          const linter = new AnalyticsLinter(
            initializedRepository,
            logger,
            loadedRules,
            (report) => reports.push(report),
            format ? ThymianFormat.import(format) : new ThymianFormat(),
            options.rules ?? {},
          );

          ctx.reply({
            reports,
            valid: await linter.run(),
          });
        },
      );

      emitter.onAction(
        'http-linter.lint-analytics',
        async ({ format, traces, transactions }, ctx) => {
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

          const reports: ThymianReport[] = [];
          const linter = new AnalyticsLinter(
            repo,
            logger,
            loadedRules,
            (report) => reports.push(report),
            format ? ThymianFormat.import(format) : new ThymianFormat(),
            options.rules ?? {},
          );

          ctx.reply({
            reports,
            valid: await linter.run(),
          });
        },
      );
    },
  };
}

function selectRules(
  runtimeRules: Rule[],
  fallbackRules: Rule[],
  ruleFilter: (rule: Rule) => boolean,
): Rule[] {
  return (runtimeRules.length > 0 ? runtimeRules : fallbackRules).filter(
    ruleFilter,
  );
}

async function runLintValidation(
  logger: Logger,
  emitter: ThymianEmitter,
  format: ThymianFormat,
  rules: Rule[],
  ruleOptions: RulesConfiguration,
): Promise<ValidationResult> {
  const reports: ThymianReport[] = [];
  const linter = new StaticLinter(
    logger,
    rules,
    (report) => {
      reports.push(report);
      emitter.emit('core.report', report);
    },
    format,
    ruleOptions,
  );

  return {
    status: (await linter.run()) ? 'success' : 'failed',
    reports,
    violations: linter.violations,
  };
}

async function runTestValidation(
  logger: Logger,
  emitter: ThymianEmitter,
  format: ThymianFormat,
  rules: Rule[],
  ruleOptions: RulesConfiguration,
): Promise<ValidationResult> {
  const reports: ThymianReport[] = [];
  const linter = new HttpTestLinter(
    createContext(format, logger, emitter),
    logger,
    rules,
    (report) => {
      reports.push(report);
      emitter.emit('core.report', report);
    },
    format,
    ruleOptions,
  );

  return {
    status: (await linter.run()) ? 'success' : 'failed',
    reports,
    violations: linter.violations,
  };
}

async function runAnalyzeValidation(
  logger: Logger,
  emitter: ThymianEmitter,
  rules: Rule[],
  ruleOptions: RulesConfiguration,
  traffic: CoreAnalyzeInput['traffic'],
  format: ThymianFormat,
): Promise<ValidationResult> {
  const repository = new SqliteHttpTransactionRepository(
    ':memory:',
    logger.child('@thymian/http-analyzer:HttpTransactionRepository'),
  );
  await repository.init();

  for (const trace of traffic.traces ?? []) {
    repository.insertHttpTrace(trace);
  }

  for (const transaction of traffic.transactions ?? []) {
    repository.insertHttpTransaction(transaction);
  }

  const reports: ThymianReport[] = [];
  const linter = new AnalyticsLinter(
    repository,
    logger,
    rules,
    (report) => {
      reports.push(report);
      emitter.emit('core.report', report);
    },
    format,
    ruleOptions,
  );

  const status = (await linter.run()) ? 'success' : 'failed';
  await repository.close();

  return {
    status,
    reports,
    violations: linter.violations,
  };
}
